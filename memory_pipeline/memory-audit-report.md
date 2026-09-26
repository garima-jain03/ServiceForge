# Memory Pipeline — Audit Report (POC)

Date: 2026-09-25
Scope: `memory_pipeline/writeHook.js`, `memory_pipeline/store.js`, `memory_pipeline/queryAndInject.js`, `memory_pipeline/memory_store.json`, audited against `pipeline/decisions/feature-2-memory-architecture.md` ("B1").

Summary
-------
The POC implements a working end-to-end round trip: a Feature-1 architectural decision (`m-0001`) is queried under the 500-token ceiling during a simulated Feature-2 task, and a new episodic fact is persisted through the non-blocking write hook with full provenance, dedupe, and retention scoring. This report is organized by the three requested parts and closes with a consolidated Build-vs-B1 gap list.

Part 1 — Write Path & Store Integration
----------------------------------------
**Implemented / matches B1:**
- Non-blocking post-turn hook (`postTurnHook` in `writeHook.js`) runs via `setImmediate`, so callers are never blocked on persistence.
- Retain/Discard filter implements B1's exact formula: `0.35*recency_norm + 0.35*importance + 0.2*freq_norm + 0.1*manual_flag`, threshold `>= 0.6`, with an epsilon tolerance (`1e-9`) added so floating-point noise at the boundary can't silently discard a borderline-important memory.
- Provenance tags present on every record: `source_task`, `timestamp`, `namespace`, `type`, `status` (`persisted`/`discarded`/`pending`), plus `occurrences`, `manual_flag`, `last_seen`.
- Feature-1 dependency persisted: `m-0001` ("no-overlap booking" decision from Feature 1) exists in the store with full provenance and is retrievable by Feature-2 queries — the specific round trip requested.
- Dedupe: content is fingerprinted (SHA-256 over normalized text) so repeated observations of the same fact increment `occurrences` and refresh `last_seen` instead of minting duplicate records; a fallback normalized-content match handles records written before fingerprinting existed. Consolidation on write merges any leftover duplicates.
- Store writes are atomic (temp file + rename) to avoid truncated/corrupted reads under concurrent access.

**Deviations from B1 (see Gaps section for severity):**
- `token_estimate` uses a `chars/4` heuristic, not the versioned `tiktoken cl100k_base` estimator B1 specifies.
- No PII pre-filter/redaction step before persistence.
- `importance` is producer-supplied only; B1 also allows auto-extraction — not implemented.
- Field is named `type`, not `type_tag` as written in the original ask (functionally equivalent, naming-only).

Part 2 — JIT Read Path & Token Ceiling
---------------------------------------
**Implemented / matches B1:**
- `queryMemory` filters by namespace, ranks candidates with `rankHybrid` (recency + relevance), and returns compressed stubs (`id, type, tl_dr, bullets, token_estimate, pointer_uri, score`).
- `enforceTokenBudget` greedily fills stubs without exceeding the hard 500-token ceiling — verified: demo run selects `m-0001` using 48/500 tokens.
- `fetchFullMemory(pointerUri)` resolves a stub's `memory://<id>` pointer to the full record, enforcing its own sub-budget (`token_estimate > tokenBudget` → rejected) — closes the two-phase progressive-disclosure loop B1 requires.
- Ranking no longer self-compares: when no query embedding is supplied, `rankHybrid` falls back to a keyword-overlap relevance proxy against `queryText` instead of scoring every candidate as a perfect match.
- Added `typeFilters` support to `queryMemory` (was missing) so callers can filter by memory type in addition to namespace, matching B1's `queryMemory(queryTextOrEmbedding, namespaceFilters, typeFilters, ...)` signature.

**Deviations from B1:**
- Relevance uses placeholder embeddings (`[0,0,0]`) and keyword overlap, not a real embedding model — ranking quality is not representative of production behavior.
- No priority-tiered budget allocation (working/episodic/semantic/procedural splits from B1's example allocation); the POC does a single flat greedy fill across all candidate types.
- `fetchFullMemory` has only an ACL placeholder comment — no real authContext check is enforced.

Part 3 — Design Validation: Build vs. B1 Audit
------------------------------------------------
**Namespace leakage — found and fixed:**
- **Bug 1 (prefix matching):** `queryByNamespace`/`queryMemory` used a raw `String.startsWith(prefix)` check. This meant a query for `serviceforge:feature-1` would also incorrectly match a hypothetical `serviceforge:feature-10:...` namespace. Fixed by adding a segment-aware `namespaceMatches(namespace, prefix)` helper (`namespace === prefix || namespace.startsWith(prefix + ':')`), now used by both `queryByNamespace` and `queryMemory`.
- **Bug 2 (cross-namespace dedupe merge — higher severity):** `findByFingerprint` and `findByNormalizedContent` matched on content alone, with no namespace check. In combination with `upsertMemory`'s consolidation pass (which also grouped purely by fingerprint / normalized content), two memories with identical text in *different* namespaces (e.g., two different sessions, or two different features) would have been silently merged into one record — incrementing occurrences and overwriting status across a namespace boundary. This directly violates B1's rule: "never cross-inject across sessions without explicit link and consent." Fixed by scoping all three lookup/consolidation paths (`findByFingerprint`, `findByNormalizedContent`, and both dedupe passes in `upsertMemory`) to require matching `namespace` in addition to fingerprint/content equality.
- Re-ran the write/read demo scripts after the fix; round trip still passes (`m-0001` retrieved at 48/500 tokens; `m-6ff55a` persists and increments occurrences within its own namespace only).

**Other deviations vs B1 (not namespace-related):**
- Store integration: all four memory boxes (Semantic/Procedural/Episodic/Working) are collapsed into a single flat JSON file with no backend routing by type. B1 calls for Vector DB + SQL/event-store + file/Git + Redis session store, routed by memory type (`D1`–`D4` in the design's write-path diagram). The POC's JSON store is an explicitly acceptable POC fallback per B1's migration path, but there is currently no logic that would route a `decision` vs an `episodic` fact differently even conceptually.
- No background consolidation/re-embedding job (B1 requires periodic hierarchical consolidation and weekly re-embedding).
- No PII redaction, encryption-at-rest, or real ACL enforcement — flagged in B1 as mandatory before production.
- No append-only immutable audit log of read/write decisions (current audit trail is `console.log` only).

Consolidated Gaps vs B1 (priority order)
-----------------------------------------
1. **High** — Cross-namespace dedupe/consolidation leakage — **fixed in this review** (see Part 3).
2. **High** — No PII redaction / ACL enforcement / encryption at rest.
3. **Medium** — `token_estimate` heuristic vs required `tiktoken cl100k_base`.
4. **Medium** — Placeholder embeddings / keyword-overlap relevance vs real embedding model + vector DB.
5. **Medium** — No backend routing by memory type (single JSON store for all four memory boxes).
6. **Low** — No priority-tiered token allocation (flat greedy fill only).
7. **Low** — No background consolidation/re-embedding job.
8. **Low** — No immutable append-only audit log.

Conclusion
----------
The POC satisfies the B2 proof-of-concept bar: working non-blocking write hooks with Retain/Discard scoring and provenance, a wired (JSON-backed) store, and a full two-phase read path (stub query → JIT fetch) enforcing the 500-token ceiling at both stages. The Part 3 audit surfaced one concrete, previously-unnoticed namespace-isolation bug (cross-namespace dedupe merging), which has been fixed and re-validated. Remaining gaps are the expected POC-to-production items already anticipated by B1's migration path (real embeddings/vector DB, PII/ACL/encryption, per-type backend routing, audit logging) and should be scheduled as explicit B2 follow-up tasks rather than blockers to this deliverable.

