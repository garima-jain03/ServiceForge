# The "develop this feature" pipeline

This is the single, tool-agnostic description of how any feature in this repo gets built. It exists so the same workflow can be followed whether you're driving it from Claude Code, GitHub Copilot, Codex, or reading it yourself. Every tool-specific file in this repo (`CLAUDE.md`, `.github/copilot-instructions.md`, `AGENTS.md`) points here.

## The trigger

Anyone — human or agent — can kick this off with a single instruction:

> **"Develop this feature: `<intent>`"**

That one line is the only input. Everything else below is how it gets turned into a shipped feature.

## The six steps

### 1 — BA (turns intent into a spec)

- **Role definition:** `.claude/agents/ba-agent.md`
- **Skill it loads:** `.claude/skills/spec-generation-skill/SKILL.md`
- **What it does:** takes the raw intent, asks what it needs to (scope, dependencies on prior features, definition of done), and commits a new file at `pipeline/features/feature-N-<slug>.md` following the same template as `pipeline/features/feature-1-technician-availability.md`.
- **What it must check first:** every existing file under `pipeline/features/` and `pipeline/decisions/`, so the new spec correctly names what it depends on instead of guessing.
- **Output:** one committed spec file. Nothing gets built yet.

### 2 — Architect (turns the spec into a reviewed design + plan)

- **Role definition:** `.claude/agents/architect-agent.md`
- **Skills it loads:** `.claude/skills/build-code-skill/SKILL.md` and, if the spec implies a new/changed model, `.claude/skills/migration-safety-skill/SKILL.md`.
- **What it does:** turns the committed spec into `pipeline/architecture-adr.md` (data flow, dependencies, scalability, tech-selection rationale, one key tradeoff, plus a design-review section that challenges its own choices and flags the riskiest decision) and `pipeline/implementation-plan.md` (component/task breakdown, dependency mapping, S/M/L effort, high-risk areas) — before any code exists.
- **Output:** two committed documents. Still nothing gets built.

### 3 — Developer (turns the plan into code)

- **Role definition:** `.claude/agents/developer-agent.md`
- **Skills it loads:** `.claude/skills/build-code-skill/SKILL.md` (stack conventions) and, if the change touches the data model, `.claude/skills/migration-safety-skill/SKILL.md`.
- **Rules it must follow:** everything under `pipeline/rules/*.md` that exists at the time.
- **What it does:** implements the spec from step 1 following the ADR's decision and the implementation plan's task breakdown from step 2, in the backend and/or frontend as required, without expanding scope beyond what the spec says.
- **Output:** working code, committed.

### 4 — Tester / QA (checks the code against the spec)

- **Role definition:** `.claude/agents/tester-agent.md`; for Feature 2 / C1 use `.claude/agents/qa-agent.md`.
- **What it does:** writes and runs tests against the Definition of Done in the spec from step 1 — not against what the code happens to do, but against what it was supposed to do — paying particular attention to whatever the ADR flagged as the riskiest decision. For Feature 2, `qa-agent` maps `pipeline/feature2/test-plan.md` to concrete tests and captures raw test output.
- **Output:** test results and, where applicable, updated test artifacts. If a failure's root cause is in the code just written for this feature, the loop returns to step 3 and then back through QA before review. If a failure's root cause instead turns out to be in a different, already-shipped feature's code, that is a `bugfix-agent` matter (see `.claude/agents/bugfix-agent.md`), not a reason to loop step 3 on scope it doesn't own.

### 5 — Reviewer (quality/security gate before PR)

- **Role definition:** `.claude/agents/reviewer-agent.md`
- **Skills it loads:** `.claude/skills/build-code-skill/SKILL.md` and, if the change touches a model's shape, `.claude/skills/migration-safety-skill/SKILL.md`.
- **What it does:** after `qa-agent`/tester has produced evidence, explicitly invokes `reviewer-agent` to read `.claude/rules/review-checklist-rule.md` by path, evaluate every checklist item as `Pass`, `Fail`, or `Needs Human Decision`, and render `Ship` or `No-Ship` with evidence. It never writes or fixes code itself. Its allowed tools are read/search tools plus Jira MCP only; Jira MCP is scoped to this agent.
- **Output:** a structured review report returned to the orchestrator, which saves it at `docs/reviews/[story-id]-review.md`. Code never reaches the PR stage without `Ship` here. On `No-Ship`, the loop returns to step 3 with only the findings as new input, then comes back through QA and this gate again before PR creation.

### 6 — PR stage

- **Role definition:** no dedicated agent in this repo yet.
- **What it does:** packages the already-tested, reviewer-shipped change for human review.
- **Output:** PR-ready state. This stage must not start unless `docs/reviews/[story-id]-review.md` exists and the final verdict is `Ship`.

## Safe recovery

If any step produces something that doesn't match its input (a spec with no Definition of Done, code that doesn't match the spec, tests that can't run), stop and surface that to a human rather than proceeding on a guess. This pipeline has no silent fallback.

## Optional: driving this with an orchestrator agent

The six steps above can be run by hand, one role at a time, or sequenced automatically by `orchestrator-agent` (`.claude/agents/orchestrator-agent.md`, with a matching `.github/prompts/orchestrator-agent.prompt.md` for Copilot). The orchestrator does not replace this document or any role — it only calls BA, Architect, Developer, Tester/QA, and Reviewer in order based on task dependencies, hands each one the minimum context it needs, still stops at both human checkpoints below, still follows the safe-recovery rule above, and tracks run state as a sequence of short entries in the feature's `pipeline/decisions/feature-N-decisions.md`. The reviewer invocation must be explicit after QA and before PR creation; do not rely on auto-delegation. Unlike before, the orchestrator *can* hand a failure to `bugfix-agent` itself — but only when its diagnosis shows the root cause is in already-shipped code, not the feature currently in flight, and `bugfix-agent`'s own human-approval requirement is never bypassed.

## Human checkpoints

A human should look at the output of step 1 (the spec) before step 2 starts, and at step 2's design-review section and riskiest-decision flag before step 3 starts — specs and designs are cheap to correct, code is not. Everything else can run unattended unless something trips the safe-recovery condition above.

## Running this in each tool

- **Claude Code:** the role files under `.claude/agents/` are real Claude Code subagents (they have the frontmatter Claude Code expects), as is `orchestrator-agent.md`. Say "develop this feature: `<intent>`" and either route through the roles in order yourself, or hand the instruction to `orchestrator-agent` to do it for you.
- **GitHub Copilot:** use the matching prompt files in `.github/prompts/` (`ba-agent.prompt.md`, `developer-agent.prompt.md`, `tester-agent.prompt.md`, `reviewer-agent.prompt.md`, `orchestrator-agent.prompt.md`) as slash commands, in the order above — add an equivalent `architect-agent.prompt.md` if this pipeline is driven that way — or paste this document into a Copilot Chat session as context.
- **Codex / any `AGENTS.md`-reading CLI agent:** `AGENTS.md` already points here. Give the same "develop this feature" instruction; the agent should read the role files under `.claude/agents/` as plain markdown (the YAML header is harmless to ignore) and follow the same steps.
- **Anyone without an agent tool:** the role files are readable specs. Do the six steps yourself, in order.

Note: For runtime sequencing and the canonical checklist locations used during automated runs, the `.claude/` artifacts are authoritative. `.github/` prompt files exist for Copilot interoperability and documentation only and must not be treated as the runtime source of truth or used to override `.claude/` sequencing or checklist paths.
