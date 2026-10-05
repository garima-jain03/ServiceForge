const assert = require('assert');
const { runPipeline } = require('../../tools/guardrails/orchestratorRunner');
const { makeTmpDir, readDecisions } = require('./utils');

async function test() {
  const dir = makeTmpDir('success-flow');
  const res = await runPipeline({
    decisionDir: dir,
    featureId: 'S1',
    tenantTier: 'free',
    estimatedChars: 1000,
    developerFn: async () => ({ plan: 'normal change', changedFiles: ['A'], trace: [] }),
    criticFn: async () => ({ pass: true, reasons: [] }),
    reviewerFn: async () => ({ verdict: 'APPROVE' }),
    testerFn: async () => ({ pass: true })
  });
  assert.strictEqual(res.status, 'DONE');
  const log = readDecisions(dir, 'S1');
  assert.ok(log.includes('DONE'));
  console.log('successful-flow.test.js passed');
}

test().catch(e => { console.error(e); process.exit(1); });
