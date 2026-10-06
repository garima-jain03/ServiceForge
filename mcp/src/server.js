/**
 * ServiceForge parts-stock MCP server — stdio transport, one write-capable tool:
 * reserve_part_for_job. See ../tool-design.md and ../tools/parts-stock-tool.md for the contract.
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const http = require('http');
// wire the demo write hook so tool calls can persist memories
const { postTurnHook } = require('../../memory_pipeline/writeHook');

const SERVICEFORGE_BASE_URL = process.env.SERVICEFORGE_BASE_URL || 'http://localhost:8080';

// Audit log prefix is configurable so this server can be reused for different tool bundles.
const MCP_TOOL_PREFIX = process.env.MCP_TOOL_PREFIX || 'mcp-tool';
// stderr only — never a full body, never a customer name (this tool never receives one).
function auditLog(event) {
  process.stderr.write(`[${MCP_TOOL_PREFIX}] ${JSON.stringify(event)}\n`);
}

/** POST {sku}/reservations against ServiceForge. Resolves to { status, body }, never throws on HTTP error status. */
function postReservation(sku, jobId, quantity) {
  const payload = JSON.stringify({ jobId, quantity });
  const url = new URL(`/api/parts/${encodeURIComponent(sku)}/reservations`, SERVICEFORGE_BASE_URL);

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let body;
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { message: raw };
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Maps ServiceForge's 400/404/409 (and connection failure) into a single actionable message.
async function reservePartForJob({ sku, jobId, quantity }) {
  let response;
  try {
    response = await postReservation(sku, jobId, quantity);
  } catch {
    const message = `ServiceForge at ${SERVICEFORGE_BASE_URL} did not respond; is mvn spring-boot:run up?`;
    auditLog({ sku, jobId, quantity, outcome: 'unreachable' });
    return { isError: true, content: [{ type: 'text', text: message }] };
  }

  const { status, body } = response;
  const serverMessage = body && body.message ? body.message : '';

  if (status === 201) {
    auditLog({ sku, jobId, quantity, outcome: 'reserved', reservationId: body.id });
    // non-blocking persistence: record the successful reservation in the memory pipeline
    try {
      postTurnHook({
        type: 'fact',
        namespace: 'serviceforge:parts:reservations',
        source_task: 'reserve_part_for_job',
        content: `Reserved ${quantity} x ${sku} for job ${jobId} (reservationId ${body.id})`,
        importance: 0.7,
      });
    } catch (err) {
      // never fail the tool because of persistence issues; log to stderr for debug
      auditLog({ event: 'writeHook_error', message: String(err && err.message ? err.message : err) });
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            reserved: true,
            reservationId: body.id,
            sku: body.sku,
            jobId: body.jobId,
            quantity: body.quantity,
          }),
        },
      ],
    };
  }

  let message;
  if (status === 400) {
    message = serverMessage
      ? `invalid reservation request: ${serverMessage}`
      : `invalid reservation request: quantity must be >= 1 (got ${quantity})`;
  } else if (status === 404) {
    message = serverMessage.includes('jobId')
      ? `unknown jobId '${jobId}'; it does not exist in ServiceForge`
      : `unknown sku '${sku}'; known skus are CMP-CLUTCH, FLT-16, THRM-STAT`;
  } else if (status === 409) {
    message = serverMessage || `insufficient stock for ${sku}: requested ${quantity}`;
  } else {
    message = `ServiceForge returned an unexpected status ${status}: ${serverMessage || JSON.stringify(body)}`;
  }

  auditLog({ sku, jobId, quantity, outcome: 'error', status });
  return { isError: true, content: [{ type: 'text', text: message }] };
}

// exported read handlers so tests can invoke them directly
async function getPartStock({ sku }) {
  const url = new URL(`/api/parts/${encodeURIComponent(sku)}`, SERVICEFORGE_BASE_URL);
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, { method: 'GET' }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let body;
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { message: raw };
          }
          resolve({ status: res.statusCode, body });
        });
      });
      req.on('error', reject);
      req.end();
    });

    const { status, body } = response;
    if (status === 200) {
      auditLog({ sku, outcome: 'queried' });
      // MCP client expects content items like text/image/resource; return JSON as text
      return { content: [{ type: 'text', text: JSON.stringify({ sku: body.sku, quantityOnHand: body.quantityOnHand }) }] };
    }
    if (status === 404) {
      auditLog({ sku, outcome: 'unknown_sku' });
      return { isError: true, content: [{ type: 'text', text: `unknown sku '${sku}'` }] };
    }
    return { isError: true, content: [{ type: 'text', text: `ServiceForge returned status ${status}` }] };
  } catch (err) {
    const message = `ServiceForge at ${SERVICEFORGE_BASE_URL} did not respond; is mvn spring-boot:run up?`;
    auditLog({ sku, outcome: 'unreachable' });
    return { isError: true, content: [{ type: 'text', text: message }] };
  }
}

async function getTechnicianAvailability({ technicianId }) {
  const url = new URL(`/api/technicians/${encodeURIComponent(technicianId)}/jobs`, SERVICEFORGE_BASE_URL);
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, { method: 'GET' }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let body;
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { message: raw };
          }
          resolve({ status: res.statusCode, body });
        });
      });
      req.on('error', reject);
      req.end();
    });

    const { status, body } = response;
    if (status === 200) {
      auditLog({ technicianId, outcome: 'queried' });
      // Return as text so MCP client accepts the content shape; callers can JSON.parse the text
      return { content: [{ type: 'text', text: JSON.stringify({ technicianId, jobs: body }) }] };
    }
    if (status === 404) {
      auditLog({ technicianId, outcome: 'unknown_technician' });
      return { isError: true, content: [{ type: 'text', text: `No technician with id ${technicianId}` }] };
    }
    return { isError: true, content: [{ type: 'text', text: `ServiceForge returned status ${status}` }] };
  } catch (err) {
    const message = `ServiceForge at ${SERVICEFORGE_BASE_URL} did not respond; is mvn spring-boot:run up?`;
    auditLog({ technicianId, outcome: 'unreachable' });
    return { isError: true, content: [{ type: 'text', text: message }] };
  }
}

function createServer() {
  const server = new McpServer({ name: 'serviceforge-parts-stock', version: '1.0.0' });

  server.registerTool(
    'reserve_part_for_job',
    {
      description:
        "Use when the dispatcher has confirmed they want to hold stock for a specific job — this is the only " +
        "tool that writes to ServiceForge. Do not call it to merely check if a part is in stock. Input is a sku, " +
        "not a free-text part name; resolve the sku from the parts catalog first if you only have a name.",
      inputSchema: {
        sku: z.string().min(1).describe("Part SKU, e.g. CMP-CLUTCH. Not a free-text name."),
        jobId: z.number().int().min(1).describe('Existing ServiceForge job id.'),
        quantity: z.number().int().min(1).describe('Units to reserve. Must be >= 1.'),
      },
    },
    async ({ sku, jobId, quantity }) => reservePartForJob({ sku, jobId, quantity })
  );

  server.registerTool(
    'get_part_stock',
    {
      description: 'Read-only: return current quantity on hand for a part SKU (no side effects).',
      inputSchema: {
        sku: z.string().min(1).describe('Part SKU, e.g. CMP-CLUTCH.'),
      },
    },
    async ({ sku }) => getPartStock({ sku })
  );

  server.registerTool(
    'get_technician_availability',
    {
      description:
        'Read-only: return the scheduled jobs for a technician. Use to display availability and verify a job slot before reservation.',
      inputSchema: {
        technicianId: z.number().int().min(1).describe('Existing technician id.'),
      },
    },
    async ({ technicianId }) => getTechnicianAvailability({ technicianId })
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  auditLog({ event: 'server_started', baseUrl: SERVICEFORGE_BASE_URL });
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[parts-stock-tool] fatal: ${err.stack || err.message}\n`);
    process.exit(1);
  });
}

module.exports = { createServer, reservePartForJob, getPartStock, getTechnicianAvailability };
