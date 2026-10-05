const assert = require('assert');
const { runPipeline } = require('../../tools/guardrails/orchestratorRunner');
const { makeTmpDir, readDecisions } = require('./utils');

async function test() {
  const dir = makeTmpDir('high-risk');
  const res = await runPipeline({
    decisionDir: dir,
    featureId: 'HR1',
    tenantTier: 'free',
    estimatedChars: 1000,
    developerFn: async () => ({ plan: 'issue_refund of $1000', changedFiles: ['A'], trace: [] }),
    criticFn: async (plan) => {
      // use real enforcer to classify
      const enforcer = require('../../tools/guardrails/enforcer');
      return enforcer.runCritic(plan, [], []);
    },
    reviewerFn: async () => ({ verdict: 'APPROVE' }),
    testerFn: async () => ({ pass: true })
  });
  assert.strictEqual(res.status, 'CRITIC_FAIL_RETRY');
  const log = readDecisions(dir, 'HR1');
  assert.ok(log.includes('CRITIC_FAIL'));
  console.log('high-risk-action.test.js passed');
}

test().catch(e => { console.error(e); process.exit(1); });
