Name: memory-retrieval-skill

Purpose
- Describe the Memory API retrieval contract and safe retrieval patterns for agents in the ServiceForge repo. Use this skill whenever an agent needs to query episodic or semantic memories (reservations, incidents, rules) so they follow token budgets, JIT fetch, and redaction rules.

When to use
- Agents adding retrieval logic to prompts or code that needs past reservation facts, incidents, or procedural playbooks.

Key rules
- Use queryMemory(queryTextOrEmbedding, namespaceFilters, typeFilters, tokenBudget=500) to request stubs.
- The Memory API must return stubs: { id, type, tl_dr, bullets, relevance_score, token_estimate, pointer_uri }.
- Inject only stubs into LLM prompts; total token_estimate for all stubs must be ≤ tokenBudget (default 500 tokens).
- If more detail is needed, call fetchFullMemory(pointer_uri, authContext) to JIT fetch the full artifact. The JIT fetch must itself respect a 500-token sub-budget.
- Always prefer: working-memory (session) stubs → episodic stubs → semantic/procedural stubs when filling the budget.

Security & PII
- Never request or inject full artifacts containing customer PII into the LLM prompt unless the agent has explicit ACL permission and the data is redacted or encrypted with a clear audit trail.
- If a fetched artifact is redacted, callers may request an unredacted version only with elevated permission and an explicit manualFlag in the request.

Examples
- Query recent reservation incidents for job 123:

  queryMemory('reservations for job 123', { namespace: ['serviceforge:parts:reservations'] }, { type: ['fact'] }, 300)

  Expect stubs with token_estimate totals ≤ 300.

Implementation notes
- The repo implements postTurnHook in memory_pipeline/writeHook.js which writes facts with a computed token_estimate and retention scoring; readers should rely on token_estimate for budget math rather than re-tokenizing at runtime.
