# Guardrails Readiness Checklist (one-page)

Use this checklist before granting production sign-off for any agentic pipeline.

- [ ] Human approvals: Are human approval points defined for irreversible actions (finance, legal, production-destructive)?
- [ ] Cost ceilings: Are per-call and per-day token budgets set and enforced with circuit breakers?
- [ ] Output sanitization: Are outputs sanitized/redacted for PII and safe to display or act upon?
- [ ] Prompt-injection harness: Are external or retrieved texts treated as data and validated, not instructions?
- [ ] Scope & least-privilege: Are tool surfaces and credentials limited per tenant/risk tier?
- [ ] Critic/verifier: Is a critic agent or rules engine integrated to score or block plans before side-effects?
- [ ] Traceability: Are execution traces logged (inputs, intermediate steps, critic decisions, final actions)?
- [ ] Retry policy: Are retry limits set for failing tool calls and agent self-correction loops? (e.g., max 2 retries)
- [ ] Test corpus: Is there a golden test corpus including prompt-injection, large-doc, and irreversibility cases in staging?
- [ ] Token telemetry: Is token consumption instrumented per-agent and per-tenant with alerting for anomalies?
- [ ] Rollback plan: Is there a clear rollback or compensation plan if the agent causes incorrect changes in production?

If any of the above are unchecked, do not promote the pipeline to full production; consider a constrained pilot with close monitoring.
