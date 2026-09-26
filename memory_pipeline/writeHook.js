// Simulated non-blocking post-turn hook: apply Retain/Discard filter and persist
const { upsertMemory, loadStore, findByFingerprint, findByNormalizedContent } = require('./store');
const crypto = require('crypto');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
function normalizeContentForFingerprint(s) {
  return s
    .replace(/[^\w\s:\-TZ]/g, '') // remove punctuation except colon, dash, T/Z
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenEstimate(text) {
  // simple proxy estimator: 1 token per 4 chars approx
  return Math.max(1, Math.ceil(text.length / 4));
}

function retentionScore({ timestamp, importance = 0.5, occurrences = 1, manual_flag = false }) {
  const ageDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
  const recency_norm = Math.exp(-ageDays / 30);
  const freq_norm = Math.min(1, occurrences / 5);
  const score = 0.35 * recency_norm + 0.35 * importance + 0.2 * freq_norm + 0.1 * (manual_flag ? 1 : 0);
  return score;
}

async function postTurnHook({ type, namespace, source_task, content, importance = 0.5, manual_flag = false }) {
  // non-blocking: schedule async processing
  setImmediate(() => {
    const timestamp = new Date().toISOString();
    const token_estimate = tokenEstimate(content);

    // fingerprint for dedupe: normalized content (lowercase, collapse whitespace, strip most punctuation)
    const normalized = normalizeContentForFingerprint(content);
    const fingerprint = sha256(normalized);

    // try to find existing memory with same fingerprint, scoped to this namespace to avoid cross-namespace leakage
    let existing = findByFingerprint(fingerprint, namespace);
    // fallback: match older records by normalized content (for items saved before fingerprinting was added)
    if (!existing) {
      existing = findByNormalizedContent(normalized, namespace);
    }

    let mem;
    if (existing) {
      // increment occurrences and merge provenance
      mem = {
        ...existing,
        occurrences: (existing.occurrences || 1) + 1,
        last_seen: timestamp,
        content: existing.content || content,
        token_estimate: Math.max(existing.token_estimate || 0, token_estimate),
        importance: Math.max(existing.importance || 0, importance),
        manual_flag: existing.manual_flag || manual_flag,
        fingerprint: existing.fingerprint || fingerprint,
        status: existing.status === 'persisted' ? 'persisted' : 'pending',
      };
    } else {
      const id = 'm-' + crypto.randomBytes(3).toString('hex');
      mem = {
        id,
        fingerprint,
        type,
        namespace,
        source_task,
        timestamp,
        content,
        tl_dr: content.split('.').slice(0,1).join('').trim(),
        bullets: [],
        embedding: [0,0,0],
        token_estimate,
        importance,
        occurrences: 1,
        manual_flag,
        status: 'pending'
      };
    }

    const score = retentionScore(mem);
    // epsilon tolerance to avoid FP near-threshold losses
    const EPS = 1e-9;
    const threshold = 0.6;
    if (score + EPS >= threshold || mem.manual_flag) {
      mem.status = 'persisted';
      upsertMemory(mem);
      console.log(`[postTurnHook] persisted ${mem.id} score=${score.toFixed(6)}`);
    } else {
      mem.status = 'discarded';
      upsertMemory(mem);
      console.log(`[postTurnHook] discarded ${mem.id} score=${score.toFixed(6)}`);
    }
  });
}

module.exports = { postTurnHook, retentionScore };

if (require.main === module) {
  // demo usage
  postTurnHook({
    type: 'fact',
    namespace: 'serviceforge:feature-2:main:dev:session-xyz',
    source_task: 'demo-poc',
    content: 'Observed conflict: part P45 double-booked between 2026-09-20T09:00 and 2026-09-20T10:00.',
    importance: 0.6
  });
}
