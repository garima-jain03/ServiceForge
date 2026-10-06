/**
 * Simulated dispatch flow: resolve sku (assumed provided), check stock, and then reserve.
 * Calls get_part_stock handler and reservePartForJob directly to verify the control flow.
 */
const assert = require('assert');
const http = require('http');

// require server after SERVICEFORGE_BASE_URL is set (see below)

async function run() {
  // start local stub for ServiceForge
  const parts = { 'FLT-16': { sku: 'FLT-16', name: 'Filter 16', quantityOnHand: 5 } };
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
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => stub.listen(0, resolve));
  const port = stub.address().port;
  process.env.SERVICEFORGE_BASE_URL = `http://localhost:${port}`;

  const { createServer, reservePartForJob } = require('../src/server');
  const { getPartStock } = require('../src/server');
  const server = createServer();
  const getPartTool = getPartStock;

  // dispatcher provided exact SKU
  const sku = 'FLT-16';
  const stock = await getPartTool({ sku });
  if (stock.isError) throw new Error('get_part_stock failed: ' + stock.content[0].text);
  const qty = stock.content[0].json.quantityOnHand;
+
  // choose to reserve 1 if available
  assert.ok(qty >= 1, 'expected available stock >= 1 for ' + sku);

  // call reserve tool
  const res = await reservePartForJob({ sku, jobId: 1, quantity: 1 });
  assert.strictEqual(res.isError, undefined, 'reserve should succeed');

  console.log('dispatch flow PASS — reserved 1', sku);
  stub.close();
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exitCode = 1;
});
