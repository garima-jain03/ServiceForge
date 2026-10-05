const fs = require('fs');
const path = require('path');
const enforcer = require('./enforcer');

function appendDecision(decisionDir, featureId, line) {
  const file = path.join(decisionDir, `feature-${featureId}-decisions.md`);
  const ts = new Date().toISOString();
  fs.appendFileSync(file, `${ts} ${line}\n`, 'utf8');
}

async function runPipeline({ decisionDir, featureId, tenantTier = 'free', developerFn, reviewerFn, testerFn, criticFn, estimatedChars = 0 }) {
  // Pre-developer token check
  const estimatedTokens = enforcer.estimateTokensFromChars(estimatedChars);
  const tokenOk = enforcer.checkTokenBudget({ tenantTier, estimatedTokens });
  if (!tokenOk.ok) {
    appendDecision(decisionDir, featureId, `TOKEN_BLOCKED: ${tokenOk.reason}`);
    return { status: 'TOKEN_BLOCKED', reason: tokenOk.reason };
  }
  if (tokenOk.warning) {
    appendDecision(decisionDir, featureId, `TOKEN_SOFT_WARNING: ${tokenOk.warning}`);
  }

  appendDecision(decisionDir, featureId, 'SPEC_CONFIRMED');

  // Developer step
  const devResult = await developerFn(); // expected to return { plan, changedFiles }
  appendDecision(decisionDir, featureId, 'IMPLEMENTED');

  // Output sanitization gate: redact PII/secrets from the plan before it is scored or logged further
  const sanitizedPlan = enforcer.sanitizeOutput(devResult.plan);
  if (sanitizedPlan !== devResult.plan) {
    appendDecision(decisionDir, featureId, 'OUTPUT_SANITIZED');
  }

  // Run critic
  const criticResult = await criticFn(sanitizedPlan, devResult.trace || [], [], tenantTier);
  if (!criticResult.pass) {
    appendDecision(decisionDir, featureId, `CRITIC_FAIL: ${criticResult.reasons.join(';')}`);
    // simple retry tracking in file: count lines that start with CRITIC_FAIL
    const file = path.join(decisionDir, `feature-${featureId}-decisions.md`);
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const retries = (content.match(/CRITIC_FAIL/g) || []).length;
    const cfg = enforcer.loadConfig();
    const max = cfg.criticMaxRetries || 2;
    if (retries <= max - 1) {
      // route back to developer with reasons
      appendDecision(decisionDir, featureId, `ROUTE_BACK_TO_DEVELOPER: ${criticResult.reasons.join(';')}`);
      return { status: 'CRITIC_FAIL_RETRY', reasons: criticResult.reasons };
    } else {
      appendDecision(decisionDir, featureId, 'CRITIC_RETRY_EXHAUSTED -> ESCALATED');
      return { status: 'ESCALATED', reasons: criticResult.reasons };
    }
  }

  appendDecision(decisionDir, featureId, 'CRITIC_PASS');

  // Reviewer
  const review = await reviewerFn(); // { verdict: 'APPROVE'|'CHANGES_REQUESTED', findings: [] }
  if (review.verdict === 'CHANGES_REQUESTED') {
    appendDecision(decisionDir, featureId, 'REVIEW_CHANGES_REQUESTED');
    return { status: 'REVIEW_CHANGES_REQUESTED', findings: review.findings };
  }
  appendDecision(decisionDir, featureId, 'REVIEWED');

  // Tester
  const testRes = await testerFn(); // { pass: true|false, failingItems: [] }
  if (!testRes.pass) {
    appendDecision(decisionDir, featureId, `TEST_FAILED: ${testRes.failingItems.join(';')}`);
    return { status: 'TEST_FAILED', failingItems: testRes.failingItems };
  }
  appendDecision(decisionDir, featureId, 'DONE');
  return { status: 'DONE' };
}

module.exports = { runPipeline };
