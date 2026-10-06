# Rule: Memory retention for Parts Reservations (RULE-MEM-001)

Intent
- Ensure facts about parts reservations (successful reserves, releases, and job-cancellation-driven releases) are persisted with redaction and token-budgeting discipline so agents can safely retrieve high-signal episodic memories about reservations.

Enforcement
- Every successful reservation (HTTP 201 from POST /api/parts/{sku}/reservations) must call the repository's memory write hook (postTurnHook or writeMemory) with:
  - namespace: `serviceforge:parts:reservations` (or a feature-scoped namespace within `serviceforge:feature-2:...`)
  - type: `fact`
  - importance >= 0.7
  - content: a concise textual fact (no customer PII), e.g. `Reserved 1 x CMP-CLUTCH for job 123 (reservationId 42)`

- Reservation releases (DELETE or job cancellation) must likewise write a `fact` with content describing the release and restore of stock.

PII and Redaction
- Do not persist customer names, addresses, or full contact details in memory. If a payload contains sensitive data, redact it before calling the memory API and set `manual_flag=true` when a human explicitly marks the artifact for retention.

Token Budgets & Retrieval
- Memory retrieval for reservation flows must follow the repository-wide token ceiling: total injected memory tokens ≤ 500.
- Memory query consumers must request stubs first (tl_dr, bullets, token_estimate, pointer_uri) and use JIT fetch for full details.

Where to apply
- backend PartController (on successful reservation), MCP server handlers that change reservation state, and the memory_pipeline write hook (already present). See memory_pipeline/writeHook.js for retention scoring implementation.

Rationale
- Reservation facts are high-value, forensic artifacts for debugging inventory conflicts and dispatch decisions. Persisting them reliably and under token-budget rules preserves recall without leaking PII or bloating prompts.

Exceptions
- For debug-only runs (developer mode), memory writes may be disabled; however, tests exercising retention must run with writes enabled to validate the retention pipeline.
