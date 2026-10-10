# review-tools-claude

A Claude Code plugin packaging ServiceForge's C2 "develop this feature" review workflow for the **shipping** stage: opening a draft GitHub pull request and running a read-only, checklist-driven review against its remote diff.

## What's included

| Component | Path | Purpose |
|---|---|---|
| `create-pr` skill | `skills/create-pr/SKILL.md` | Deliberately invoked skill that opens a **draft** PR via GitHub MCP `create_pull_request`. Never auto-runs, never merges/pushes. |
| `review-pr` skill | `skills/review-pr/SKILL.md` | Defines the pending-review transaction (`create` → `add_comment_to_pending_review` → `submit_pending`) against a remote PR diff. |
| `pr-reviewer` agent | `agents/pr-reviewer.md` | Read-only agent that loads `.claude/rules/review-checklist-rule.md` by path, fetches the PR via GitHub MCP, and submits one coherent review. |
| MCP config | `.mcp.json` | GitHub MCP server wiring with a runtime placeholder for the token — no secret values committed. |

See `PLUGIN_INVENTORY.md` for the full file-by-file rationale and exclusions.

## Install / sideload (Claude Code)

From the plugin directory:

```bash
claude plugin validate ./review-tools-claude
claude --plugin-dir ./review-tools-claude
```

Once loaded, invoke the namespaced skills/agent:

```
/review-tools-claude:create-pr
/review-tools-claude:review-pr 42
```

or select the `pr-reviewer` agent directly from the agent picker.

### GitHub MCP auth

Set `GITHUB_PERSONAL_ACCESS_TOKEN` in your shell/environment before launching Claude Code. `.mcp.json` only references `${GITHUB_PERSONAL_ACCESS_TOKEN}` — the token itself is never written to this repo.

## Update / reload test

1. Bump `version` in `.claude-plugin/plugin.json` (e.g. `1.0.0` → `1.0.1`).
2. Make a small, safe source change (e.g. a wording clarification in a `SKILL.md`).
3. Run `/reload-plugins` inside an active Claude Code session using `--plugin-dir ./review-tools-claude`.
4. Confirm the reloaded skill/agent reflects the change without restarting the session.

Document the actual test run (Claude Code version, validate/sideload output, reload result) in `pipeline/feature2/ai-use-log.md` or the session's AI-use log.

## Boundaries

- No application source, tests, build output, screenshots, plans, review reports, `.env` files, credentials, or tokens are packaged here — see `PLUGIN_INVENTORY.md`.
- Neither the skills nor the agent ever merge a PR, push code, create branches, or edit repository files. The only side effect is: one draft PR (via `create-pr`) and one submitted PR review (via `pr-reviewer`).
- The checklist itself (`.claude/rules/review-checklist-rule.md`) stays in the consuming repository, not inside this plugin — the plugin only reads it by path, so updates to the checklist don't require a plugin version bump.
