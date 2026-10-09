# CLAUDE.md — ServiceForge (Claude Code)

@AGENTS.md

The above import brings in the tool-agnostic project rules. Everything below is Claude-Code-specific.

## Subagents

This repo defines several subagents under `.claude/agents/` that participate in the pipeline described in `pipeline/orchestration.md`.

- `ba-agent` — turns a feature intent into a committed spec under `pipeline/features/`.
- `architect-agent` — produces an ADR and implementation plan from a committed spec.
- `developer-agent` — implements a committed spec into working code, loading the relevant skills and rules.
- `reviewer-agent` — after QA/test evidence, reads the canonical checklist by path and performs a read-only quality/security review before the PR stage.
- `critic-agent` — lightweight verifier that evaluates a developer's plan and trace against guardrails and returns a JSON pass/fail verdict used by the orchestrator.
- `tester-agent` — writes and runs tests against a spec's Definition of Done.
- `qa-agent` — a repo-scoped extension of the tester role that maps Feature 2's test-plan to concrete tests and run actions.
- `bugfix-agent` — senior-level bug-fix agent that triages, proposes a smallest safe patch with regression tests, and waits for human approval before applying.

Invoke them via the orchestrator or directly when appropriate. For the normal "develop this feature" flow the orchestrator sequences: BA → Architect → Developer → Critic → Tester/QA → Reviewer → PR-ready handoff.

## Skills

Skills live under `.claude/skills/<skill-name>/SKILL.md` (standard Claude Agent Skills format) and are loaded automatically when relevant:

- `build-code-skill` — backend + frontend stack conventions for this repo.
- `spec-generation-skill` — how the BA agent turns intent into a feature spec.
- `migration-safety-skill` — how to evolve the mock data model without breaking existing consumers (there is no real database, but the same discipline applies to the in-memory model).

- `memory-retrieval-skill` — guidance and API contract for safely querying and injecting memory stubs, token-budget rules, and PII/redaction practices. Agents doing JIT memory retrieval or prompt-augmentation should load this skill.

## Memory note for this repo

Feature-by-feature decisions (the facts a later feature may need to retrieve) are logged under `pipeline/decisions/`, one file per feature — starting with `pipeline/decisions/feature-1-decisions.md`. Do not rely on conversation history alone to carry these facts forward; they are committed here specifically so they can be retrieved on demand instead of kept in context permanently.

Operational notes
- Operational guardrails and the reviewer checklist are enforced by the orchestrator and live under pipeline/rules/ and .claude/rules/ (see pipeline/rules/guardrails-config.json and .claude/rules/review-checklist-rule.md).
