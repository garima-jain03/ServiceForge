const assert = require('assert');
const { runPipeline } = require('../../tools/guardrails/orchestratorRunner');
const { makeTmpDir, readDecisions } = require('./utils');

async function test() {
  const dir = makeTmpDir('critic-retry');
  let attempts = 0;
  const res1 = await runPipeline({
    decisionDir: dir,
    featureId: 'CR1',
    tenantTier: 'free',
    estimatedChars: 1000,
    developerFn: async () => ({ plan: 'fix something', changedFiles: ['A'], trace: [] }),
    criticFn: async () => {
      attempts += 1;
      return { pass: false, reasons: ['flaky check'] };
    },
    reviewerFn: async () => ({ verdict: 'APPROVE' }),
    testerFn: async () => ({ pass: true })
  });
  // First run should be CRITIC_FAIL_RETRY (retry allowed)
  assert.strictEqual(res1.status, 'CRITIC_FAIL_RETRY');
  // Simulate second attempt
  const res2 = await runPipeline({
    decisionDir: dir,
    featureId: 'CR1',
    tenantTier: 'free',
    estimatedChars: 1000,
    developerFn: async () => ({ plan: 'fix something v2', changedFiles: ['A'], trace: [] }),
    criticFn: async () => ({ pass: false, reasons: ['still flaky'] }),
    reviewerFn: async () => ({ verdict: 'APPROVE' }),
    testerFn: async () => ({ pass: true })
  });
  // Second run will either be CRITIC_FAIL_RETRY or ESCALATED depending on config; read log
  const log = readDecisions(dir, 'CR1');
  const failCount = (log.match(/CRITIC_FAIL/g) || []).length;
  assert.ok(failCount >= 1);
  console.log('critic-retry.test.js passed (failCount=' + failCount + ')');
}

test().catch(e => { console.error(e); process.exit(1); });
