const { loadStore, fetchById, namespaceMatches } = require('./store');

function cosineSim(a, b) {
  // small helper for demo; assume same length
  let dot = 0, na = 0, nb = 0;
  for (let i=0;i<a.length;i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na)*Math.sqrt(nb)+1e-8);
}

function keywordOverlap(queryText, content) {
  if (!queryText) return 0;
  const qWords = new Set(queryText.toLowerCase().match(/\w+/g) || []);
  const cWords = new Set((content || '').toLowerCase().match(/\w+/g) || []);
  if (qWords.size === 0 || cWords.size === 0) return 0;
  let hits = 0;
  for (const w of qWords) if (cWords.has(w)) hits++;
  return hits / qWords.size;
}

function rankHybrid(candidates, queryEmbedding, recencyWeight=0.5, queryText=null) {
  const now = Date.now();
  return candidates.map(c => {
    // real embedding vs candidate when available; otherwise fall back to keyword overlap
    // instead of self-comparing (which would falsely score every candidate as a perfect match)
    const rel = queryEmbedding ? cosineSim(queryEmbedding, c.embedding || [0,0,0]) : keywordOverlap(queryText, c.content);
    const ageDays = (now - new Date(c.timestamp).getTime())/(1000*60*60*24);
    const recency = Math.exp(-ageDays/30);
    const score = recencyWeight*recency + (1-recencyWeight)*rel;
    return { ...c, score };
  }).sort((x,y)=>y.score - x.score);
}

function enforceTokenBudget(stubs, tokenBudget=500) {
  const out = [];
  let used = 0;
  for (const s of stubs) {
    if (used + (s.token_estimate||0) > tokenBudget) break;
    out.push(s);
    used += (s.token_estimate||0);
  }
  return { selected: out, used };
}

function queryMemory({ queryText, namespacePrefix='serviceforge:feature-1', typeFilters=null, tokenBudget=500, recencyWeight=0.5 }) {
  // demo: load store, filter namespace (+ optional type), rank, produce stubs and enforce budget
  const store = loadStore();
  let candidates = store.memories.filter(m => namespaceMatches(m.namespace, namespacePrefix));
  if (typeFilters && typeFilters.length > 0) {
    candidates = candidates.filter(m => typeFilters.includes(m.type));
  }

  // For POC we do not compute real query embeddings; rank via keyword-overlap relevance proxy
  const ranked = rankHybrid(candidates, null, recencyWeight, queryText);
  const stubs = ranked.map(r => ({ id: r.id, type: r.type, tl_dr: r.tl_dr, bullets: r.bullets, token_estimate: r.token_estimate, pointer_uri: `memory://${r.id}`, score: r.score }));

  const { selected, used } = enforceTokenBudget(stubs, tokenBudget);
  return { selected, used, totalCandidates: stubs.length };
}

function fetchFullMemory(pointerUri, { tokenBudget = 500 } = {}) {
  const match = /^memory:\/\/(.+)$/.exec(pointerUri || '');
  if (!match) return { error: 'invalid pointer_uri' };

  const mem = fetchById(match[1]);
  if (!mem) return { error: 'not found', id: match[1] };

  // ACL placeholder: production must check authContext against mem.namespace/ACLs here
  if (mem.token_estimate > tokenBudget) {
    return { error: 'exceeds sub-budget', id: mem.id, token_estimate: mem.token_estimate, tokenBudget };
  }

  return {
    id: mem.id,
    type: mem.type,
    namespace: mem.namespace,
    source_task: mem.source_task,
    timestamp: mem.timestamp,
    content: mem.content,
    token_estimate: mem.token_estimate,
    status: mem.status
  };
}

module.exports = { queryMemory, enforceTokenBudget, rankHybrid, fetchFullMemory };

if (require.main === module) {
  const res = queryMemory({ namespacePrefix: 'serviceforge:feature-1', tokenBudget: 500 });
  console.log('queryMemory result:', res);

  if (res.selected.length > 0) {
    const full = fetchFullMemory(res.selected[0].pointer_uri);
    console.log('fetchFullMemory result:', full);
  }
}
