const assert = require('assert');
const { runPipeline } = require('../../tools/guardrails/orchestratorRunner');
const { makeTmpDir, readDecisions } = require('./utils');

async function test() {
  const dir = makeTmpDir('token-budget');
  const res = await runPipeline({
    decisionDir: dir,
    featureId: 'TB1',
    tenantTier: 'free',
    estimatedChars: 500000, // very large to exceed per-call hard limit (approx 125k tokens)
    developerFn: async () => ({ plan: 'normal change', changedFiles: ['A'] }),
    criticFn: async () => ({ pass: true, reasons: [] }),
    reviewerFn: async () => ({ verdict: 'APPROVE' }),
    testerFn: async () => ({ pass: true })
  });
  assert.strictEqual(res.status, 'TOKEN_BLOCKED');
  const log = readDecisions(dir, 'TB1');
  assert.ok(log.includes('TOKEN_BLOCKED'));
  console.log('token-budget.test.js passed');
}

test().catch(e => { console.error(e); process.exit(1); });
