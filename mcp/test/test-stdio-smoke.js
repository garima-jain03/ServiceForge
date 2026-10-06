/**
 * End-to-end stdio round-trip: spawns the real MCP server process, lists tools,
 * and calls reserve_part_for_job over the actual MCP protocol (not the raw function).
 */
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function run() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', 'src', 'server.js')],
  });

  const client = new Client({ name: 'smoke-test-client', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('tools/list ->', tools.tools.map((t) => t.name));

  const reserveArgs1 = { sku: 'THRM-STAT', jobId: 1, quantity: 15 };
  console.log('calling reserve_part_for_job with ->', reserveArgs1);
  const result = await client.callTool({ name: 'reserve_part_for_job', arguments: reserveArgs1 });
  console.log('tools/call reserve_part_for_job ->', result.content[0].text);

  const reserveArgs2 = { sku: 'FLT-16', jobId: 2, quantity: 999 };
  console.log('calling reserve_part_for_job with ->', reserveArgs2);
  const badResult = await client.callTool({ name: 'reserve_part_for_job', arguments: reserveArgs2 });
  console.log('tools/call (409 expected) ->', badResult.isError, badResult.content[0].text);

  await client.close();
}

run().catch((err) => {
  console.error('SMOKE TEST FAILURE:', err);
  process.exitCode = 1;
});
