---
paths:
  - pipeline/features/**
  - backend/**
  - frontend/**
id: review-checklist-v1
title: Review checklist rule (Claude Code canonical)
---

# Review Checklist — ServiceForge (Claude Code rule)

This rule is the canonical Claude Code representation of the repository's review checklist. Reviewer subagents must read it by path (do not rely on a copy pasted into the prompt) and evaluate the proposed change against each check below. The rule is written so that each item is a checkable condition on the proposed content, not a high-level goal.

Areas:

1) Jira AC verification
- Condition: For every `Acceptance criteria` item in `pipeline/features/feature-*-*.md` referenced by the run, the reviewer must find at least one file and method that implements the AC's behavior. If an AC names a REST contract, the reviewer must verify the endpoint signature and status-code behavior.
- Seed failure conditions: missing endpoint; status-code mismatch; required error body shape absent.

2) Quality audit
- Condition: No controller may contain business logic beyond basic orchestration; services must encapsulate business rules; DTOs must be simple POJOs; method names must be descriptive and unambiguous.
- Seed failure conditions: business logic in controllers; ambiguous names; public mutable fields on models.

3) Security review
- Condition: All new/changed endpoints must validate external input and return `ApiError` on bad input; no literal secrets in code; LLM prompt inputs must pass configured prompt-injection guard prior to storage or forwarding.
- Mandatory item: "Secrets-scan hook reported clean for this diff" — the review agent must consult the PreToolUse hook result produced for this proposed change and mark this item Pass only if that hook returned success for all modified files. The agent must not re-run the secrets scan in its own execution; it must trust the hook's result.
- Seed failure conditions: hook reported secrets; missing validation; unsafe deserialization.

4) Compliance
- Condition: No active rule in `pipeline/rules/*.md` is violated by the proposed change. The reviewer must read each rule file and confirm compliance.
- Seed failure conditions: bypassing a pipeline guardrail; adding disallowed patterns.

5) Design alignment
- Condition: Implementation matches the ADR `pipeline/architecture-adr.md` and recorded tradeoffs for the feature; any divergence must be reported and classified as scope drift or an acceptable local refactor with justification.
- Seed failure conditions: touching out-of-scope subsystems; choosing a data-storage pattern the ADR forbids.

Each item must be considered Pass / Fail / Needs Human Decision. The reviewer output must be a structured markdown document with one section per area and each item resolved. The final verdict must be `Ship` or `No-Ship` with a short, evidence-backed justification.
