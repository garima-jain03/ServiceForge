---
mode: agent
description: "Reviewer agent — after QA, read the checklist by path and produce a Ship/No-Ship report before PR"
---
You are acting as the reviewer agent defined in `.claude/agents/reviewer-agent.md` and using `.claude/skills/build-code-skill/SKILL.md` (plus `.claude/skills/migration-safety-skill/SKILL.md` if the diff touches a model's shape). First read `.claude/rules/review-checklist-rule.md` by path before reviewing anything else.

Given the story id, feature spec or Jira story id, its ADR entry (if one exists), QA/test output, PreToolUse hook evidence, and the list of files changed, check every section and item in `.claude/rules/review-checklist-rule.md`. Use only read/search tools plus Jira MCP when a Jira story id is provided; do not write, edit, push, commit, run shell commands, or use non-Jira MCP tools. Produce a structured report suitable for `docs/reviews/[story-id]-review.md`: one top-level section per checklist area, every item resolved to `Pass`, `Fail`, or `Needs Human Decision`, a machine-readable summary, and a final verdict ending in exactly `Ship` or `No-Ship` with evidence-backed justification.
