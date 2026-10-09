AI Use Log — Feature 2 Test & Verify

Actions performed by AI assistant:

- Parsed pipeline/features/feature-2-parts-reservation.md (AC1-9, edge cases E1-E4) and pipeline/architecture-adr.md, then wrote pipeline/feature2/test-plan.md mapping every AC/edge case to a concrete test.
- Implemented the production code the ADR described but the repo was missing:
  - backend/src/main/java/com/serviceforge/service/PartsReservationService.java (new)
  - backend/src/main/java/com/serviceforge/service/TechnicianAvailabilityService.java (extended: isValidNonOverlapping, cancelJob)
  - backend/src/main/java/com/serviceforge/data/MockDataStore.java (extended: findReservation, getReservationsForJob, releaseReservation, releaseAllForJob)
  - backend/src/main/java/com/serviceforge/model/PartReservation.java (extended: ACTIVE/RELEASED status)
  - backend/src/main/java/com/serviceforge/controller/PartController.java (refactored to delegate to the service; added DELETE /reservations/{id})
  - backend/src/main/java/com/serviceforge/controller/JobController.java (added GET .../reservations and POST .../cancel)
  - backend/src/main/java/com/serviceforge/util/PromptInjectionGuard.java (new) + ReservePartRequest.notes screened before reaching the service
- Added/updated unit tests for every AC, edge case, and the notes guardrail (PartControllerTest, JobControllerTest, PartsReservationServiceTest, TechnicianAvailabilityServiceTest, MockDataStoreConcurrencyTest).
- Added pipeline/rules/job-notes-injection-guardrail.md (missing from checkout) and the QA agent at .claude/agents/qa-agent.md (single canonical location, no duplicate copy).
- Added .vscode/tasks.json (manual run) and .github/workflows/feature2-tests.yml (CI on backend/** changes) to run the suite automatically.
- Ran mvn -f backend test — 41/41 passing, captured in pipeline/feature2/test-suite-output.txt.

Review stage additions (C2 Review Layer, Claude-only):
- Canonical review checklist and agents live under `.claude/` (`.claude/rules/review-checklist-rule.md`, `.claude/agents/review-agent.md`, `.claude/agents/reviewer-agent.md`), per the Claude-only policy in CLAUDE.md and AGENTS.md — no parallel Copilot review agent/checklist is maintained.
- Added PreToolUse secrets hook (`.claude/hooks/secretsHook.js`, registered in `.claude/settings.json`); verified it blocks a planted fake AWS key (exit 2) and allows clean content (exit 0).
- Produced a sample review report `docs/reviews/feature-2-parts-reservation-review.md` demonstrating a No-Ship with concrete findings.

Reflection:
- The review agent caught a concurrency underflow risk in MockDataStore that nominal unit tests wouldn't simulate. The PreToolUse hook caught a planted secret the qa-agent's tests don't check for.

