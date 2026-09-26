/**
 * Exercises reserve_part_for_job's three error cases (400/404/409) plus one success case,
 * calling the tool function directly (no stdio round-trip needed to prove the contract).
 */
const assert = require('assert');
const { reservePartForJob } = require('../src/server');

async function run() {
  const results = [];

  // Success — FLT-16 has plenty of stock.
  const ok = await reservePartForJob({ sku: 'FLT-16', jobId: 1, quantity: 1 });
  assert.strictEqual(ok.isError, undefined, 'expected success result to have no isError flag');
  const okBody = JSON.parse(ok.content[0].text);
  assert.strictEqual(okBody.reserved, true);
  results.push(['success (201)', 'PASS', ok.content[0].text]);

  // 400 — quantity below minimum, only enforced by request validation, so bypass tool-level
  // schema by calling reservePartForJob directly with an invalid value.
  const badQuantity = await reservePartForJob({ sku: 'FLT-16', jobId: 1, quantity: 0 });
  assert.strictEqual(badQuantity.isError, true);
  results.push(['400 invalid quantity', 'PASS', badQuantity.content[0].text]);

  // 404 — unknown sku.
  const unknownSku = await reservePartForJob({ sku: 'NOPE-1', jobId: 1, quantity: 1 });
  assert.strictEqual(unknownSku.isError, true);
  assert.ok(unknownSku.content[0].text.includes('unknown sku'), 'expected unknown-sku message');
  results.push(['404 unknown sku', 'PASS', unknownSku.content[0].text]);

  // 404 — unknown jobId.
  const unknownJob = await reservePartForJob({ sku: 'FLT-16', jobId: 999999, quantity: 1 });
  assert.strictEqual(unknownJob.isError, true);
  assert.ok(unknownJob.content[0].text.includes('unknown jobId'), 'expected unknown-job message');
  results.push(['404 unknown jobId', 'PASS', unknownJob.content[0].text]);

  // 409 — CMP-CLUTCH is seeded with only 1 unit on hand.
  const insufficientStock = await reservePartForJob({ sku: 'CMP-CLUTCH', jobId: 1, quantity: 5 });
  assert.strictEqual(insufficientStock.isError, true);
  assert.ok(insufficientStock.content[0].text.includes('insufficient stock'), 'expected insufficient-stock message');
  results.push(['409 insufficient stock', 'PASS', insufficientStock.content[0].text]);

  for (const [name, status, text] of results) {
    console.log(`${status} — ${name}: ${text}`);
  }
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exitCode = 1;
});
