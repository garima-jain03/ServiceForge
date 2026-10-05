const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../pipeline/rules/guardrails-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    // sensible defaults
    return {
      perTenantDailyTokenBudget: { free: 100000, paid: 2000000 },
      perCallSoftLimitTokens: 20000,
      perCallHardLimitTokens: 50000,
      criticMaxRetries: 2,
      irreversibilityActions: ["issue_refund", "delete_database", "drop_table", "destroy"],
      tenantScopeRestrictions: { free: ["delete_database", "drop_table"] },
      promptInjectionPatterns: ["ignore prior", "ignore previous", "ignore instructions", "refund $"],
      promptInjectionSensitivity: "high"
    };
  }
}

function estimateTokensFromChars(chars) {
  return Math.max(1, Math.round(chars / 4));
}

function checkTokenBudget({ tenantTier = 'free', estimatedTokens = 0 }) {
  const cfg = loadConfig();
  const perCallHard = cfg.perCallHardLimitTokens || 50000;
  const perCallSoft = cfg.perCallSoftLimitTokens || Math.round(perCallHard / 2);

  if (estimatedTokens > perCallHard) {
    return { ok: false, reason: `per-call hard limit exceeded: ${estimatedTokens} > ${perCallHard}` };
  }
  if (estimatedTokens > perCallSoft) {
    return { ok: true, warning: `per-call soft cap exceeded: ${estimatedTokens} > ${perCallSoft}; approval-to-extend recommended` };
  }
  // Per-tenant daily consumption tracking is out of scope for this minimal integration.
  return { ok: true };
}

function checkScope(tenantTier, actionDescriptor) {
  const cfg = loadConfig();
  const restricted = (cfg.tenantScopeRestrictions && cfg.tenantScopeRestrictions[tenantTier]) || [];
  const desc = (actionDescriptor || '').toLowerCase();
  for (const pat of restricted) {
    if (desc.includes(pat)) return { allowed: false, evidence: [pat] };
  }
  return { allowed: true, evidence: [] };
}

function classifyActionRisk(actionDescriptor) {
  const cfg = loadConfig();
  const desc = (actionDescriptor || '').toLowerCase();
  for (const pat of cfg.irreversibilityActions || []) {
    if (desc.includes(pat)) return { risk: 'irreversible', evidence: [pat] };
  }
  // medium risk heuristics
  if (desc.includes('refund') || desc.includes('charge') || desc.includes('delete')) {
    return { risk: 'high', evidence: ['mentions financial/deletion'] };
  }
  return { risk: 'low', evidence: [] };
}

function detectPromptInjection(text) {
  const cfg = loadConfig();
  const lower = (text || '').toLowerCase();
  const evidence = [];
  for (const pat of cfg.promptInjectionPatterns || []) {
    if (lower.includes(pat)) evidence.push(pat);
  }
  return { injection: evidence.length > 0, evidence };
}

function sanitizeOutput(text) {
  if (!text) return text;
  // redact simple SSN-like patterns and long digit sequences
  return text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]').replace(/\b\d{6,}\b/g, '[REDACTED_NUMBER]');
}

async function runCritic(plan = '', trace = [], policies = [], tenantTier = 'free') {
  // Lightweight deterministic critic for the harness: FAIL if prompt injection or irreversible action without guard
  const pi = detectPromptInjection(plan + ' ' + JSON.stringify(trace));
  if (pi.injection) return { pass: false, reasons: ['prompt_injection_detected:' + pi.evidence.join(',')] };

  const actionRisk = classifyActionRisk(plan);
  if (actionRisk.risk === 'irreversible') {
    return { pass: false, reasons: ['irreversible_action:' + actionRisk.evidence.join(',')] };
  }

  const scope = checkScope(tenantTier, plan);
  if (!scope.allowed) {
    return { pass: false, reasons: ['scope_violation:' + scope.evidence.join(',')] };
  }

  // If policies contain explicit prohibit rules, check them naively
  for (const p of policies || []) {
    if ((plan || '').toLowerCase().includes((p || '').toLowerCase())) {
      return { pass: false, reasons: ['policy_block:' + p] };
    }
  }

  return { pass: true, reasons: [] };
}

module.exports = {
  loadConfig,
  estimateTokensFromChars,
  checkTokenBudget,
  checkScope,
  classifyActionRisk,
  detectPromptInjection,
  sanitizeOutput,
  runCritic
};
