/**
 * Tests get_part_stock and get_technician_availability by calling the server handlers directly.
 */
const assert = require('assert');
const http = require('http');

async function run() {
  // start a stub ServiceForge HTTP server so tools can talk to it
  const parts = {
    'CMP-CLUTCH': { sku: 'CMP-CLUTCH', name: 'Compressor Clutch', quantityOnHand: 1 },
    'FLT-16': { sku: 'FLT-16', name: 'Filter 16', quantityOnHand: 5 },
  };

  const techJobs = { '1': [{ id: 1, job: 'Inspect AC' }] };

  const stub = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname.startsWith('/api/parts/')) {
      const sku = decodeURIComponent(url.pathname.replace('/api/parts/', ''));
      if (parts[sku]) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parts[sku]));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'unknown sku' }));
      }
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/technicians/')) {
      const id = url.pathname.split('/')[3];
      if (techJobs[id]) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(techJobs[id]));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'not found' }));
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => stub.listen(0, resolve));
  const port = stub.address().port;
  process.env.SERVICEFORGE_BASE_URL = `http://localhost:${port}`;

  // require the server after env is set so it reads the correct base URL
  const { createServer, getPartStock, getTechnicianAvailability } = require('../src/server');
  const server = createServer();
  const partTool = getPartStock;
  const techTool = getTechnicianAvailability;
  if (!partTool || !techTool) {
    throw new Error('tools not registered on server');
  }

  // expect seeded CMP-CLUTCH to exist with quantity 1
  const partRes = await partTool({ sku: 'CMP-CLUTCH' });
  assert.strictEqual(partRes.isError, undefined);
  const q = partRes.content[0].json.quantityOnHand;
  assert.strictEqual(q, 1, 'expected CMP-CLUTCH quantityOnHand 1');

  // unknown sku -> isError
  const unknown = await partTool({ sku: 'NOPE-1' });
  assert.strictEqual(unknown.isError, true);

  // test technician availability for technician 1 (seeded)
  const techRes = await techTool({ technicianId: 1 });
  assert.strictEqual(techRes.isError, undefined);
  assert.ok(Array.isArray(techRes.content[0].json.jobs));
  
  console.log('read-tools tests PASS');
  stub.close();
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exitCode = 1;
});
