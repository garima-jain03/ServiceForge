const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'memory_store.json');

function loadStore() {
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveStore(store) {
  // atomic write: temp file + rename avoids truncated/corrupted reads on concurrent access
  const tmpPath = STORE_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function upsertMemory(mem) {
  const store = loadStore();
  const idx = store.memories.findIndex(m => m.id === mem.id);
  if (idx >= 0) {
    store.memories[idx] = { ...store.memories[idx], ...mem };
  } else {
    store.memories.push(mem);
  }

  // Consolidate duplicates that share the same fingerprint AND namespace (merge occurrences and remove duplicates)
  // namespace is included in the match to prevent cross-namespace memory leakage during consolidation
  if (mem.fingerprint) {
    const prim = store.memories.find(m => m.id === mem.id);
    if (prim) {
      const duplicates = store.memories.filter(m => m.id !== prim.id && m.fingerprint === prim.fingerprint && m.namespace === prim.namespace);
      for (const d of duplicates) {
        prim.occurrences = (prim.occurrences || 1) + (d.occurrences || 0);
        // keep the earliest timestamp
        if (new Date(d.timestamp) < new Date(prim.timestamp)) prim.timestamp = d.timestamp;
      }
      // remove duplicates (same namespace only)
      store.memories = store.memories.filter(m => !(m.fingerprint === prim.fingerprint && m.namespace === prim.namespace && m.id !== prim.id));
    }
  }
  // Additional consolidation: merge any entries that normalize to the same content (handles legacy/fingerprint mismatch)
  try {
    const normalize = (s) => s.replace(/[^\n\w\s:\-TZ]/g, '').replace(/\s+/g,' ').trim().toLowerCase();
    const byNorm = new Map();
    for (const m of store.memories) {
      // namespace is part of the grouping key so records are never merged across namespace boundaries
      const key = m.content ? `${m.namespace || ''}::${normalize(m.content)}` : null;
      if (!key) continue;
      if (!byNorm.has(key)) byNorm.set(key, []);
      byNorm.get(key).push(m);
    }
    // merge groups with >1 entry
    for (const [key, group] of byNorm.entries()) {
      if (group.length <= 1) continue;
      // choose primary as the earliest-created (smallest timestamp)
      group.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      const primary = group[0];
      for (let i = 1; i < group.length; i++) {
        const d = group[i];
        primary.occurrences = (primary.occurrences || 1) + (d.occurrences || 0);
        if (new Date(d.timestamp) < new Date(primary.timestamp)) primary.timestamp = d.timestamp;
      }
      // remove merged ones
      store.memories = store.memories.filter(m => !group.slice(1).some(g => g.id === m.id));
    }
  } catch (e) {
    // non-fatal for POC
    console.warn('consolidation error', e);
  }
  saveStore(store);
}

function namespaceMatches(namespace, prefix) {
  // segment-aware match: 'a:b' must match 'a:b' or 'a:b:...', not 'a:b2'
  if (!namespace || !prefix) return false;
  return namespace === prefix || namespace.startsWith(prefix + ':');
}

function queryByNamespace(namespacePrefix) {
  const store = loadStore();
  return store.memories.filter(m => namespaceMatches(m.namespace, namespacePrefix));
}

function findByFingerprint(fingerprint, namespace) {
  const store = loadStore();
  return store.memories.find(m => m.fingerprint && m.fingerprint === fingerprint && (!namespace || m.namespace === namespace)) || null;
}

function findByNormalizedContent(normalizedContent, namespace) {
  const store = loadStore();
  // prefer exact fingerprint matches, but fall back to comparing normalized content for older records
  // scoped to the same namespace to avoid merging/leaking content across namespace boundaries
  return store.memories.find(m => {
    if (m.fingerprint) return false; // already fingerprinted records handled by findByFingerprint
    if (!m.content) return false;
    if (namespace && m.namespace !== namespace) return false;
    const existingNorm = m.content.replace(/[^\n\w\s:\-TZ]/g, '').replace(/\s+/g,' ').trim().toLowerCase();
    return existingNorm === normalizedContent;
  }) || null;
}

function fetchById(id) {
  const store = loadStore();
  return store.memories.find(m => m.id === id) || null;
}

module.exports = { loadStore, saveStore, upsertMemory, queryByNamespace, fetchById, findByFingerprint, findByNormalizedContent, namespaceMatches };

if (require.main === module) {
  console.log('store loaded entries:', loadStore().memories.length);
}
