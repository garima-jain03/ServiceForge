Time log — Feature 2 Test & Verify (home task)

Estimated vs Actual

Part A — Test planning: Est ~15 min; Actual 18 min
Part B — Build & Verify (tests + wiring): Est ~35 min; Actual 55 min
Write-up & pipeline wiring: Est ~10 min; Actual 15 min

Total Est: ~60 min; Total Actual: ~88 min (+ ~20 min gap-review pass below)

Gap-review pass (post-submission review before C2)
- Found qa-agent.md existed only at pipeline/feature2/, not at the task-specified .github/agents/qa-agent.agent.md location, and had no tool scoping. Added .github/agents/qa-agent.agent.md with tools: [read, edit, runCommands].
- Found the guardrail "bypass" test only proved Jackson silently drops an unknown notes field — it never actually exercised a block. Added ReservePartRequest.notes + PromptInjectionGuard (Java port of enforcer.js's detectPromptInjection) and a real reservePart_rejectsInjectionShapedNotesField test asserting 400 + zero interaction with the reservation service.
- Found no automatic pipeline wiring beyond a manually-triggered tasks.json entry. Added .github/workflows/feature2-tests.yml (CI step) running mvn -f backend test on backend/** changes.
- Re-ran mvn -f backend test: 41/41 passing, recaptured into test-suite-output.txt.

Notes
- Part B ran over estimate: only AC1/AC2/AC4/AC9/E1 were backed by existing production code on first pass. Proving AC3, AC5-AC8, and E2/E4 required implementing the missing production seams (PartsReservationService, reservation listing/release endpoints, the job-cancellation release hook, and live Feature-1 revalidation) rather than leaving them as documented gaps, since "any AC with no passing test behind it is a gap — fix the test, don't relax the mapping" ruled out just documenting around them.
- Discovered mid-task that `pipeline/rules/job-notes-injection-guardrail.md`, `.claude/agents/reservation-critic-agent.md`, and `pipeline/feature2/optimization-report.md` — all listed as already-true-in-the-repo B4/Kata-1 carryover — were not actually present in this checkout. Added the missing guardrail rule file; did not fabricate the critic agent or optimization report since those are out of this task's scope to invent from nothing.
