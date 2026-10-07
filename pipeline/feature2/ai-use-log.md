AI Use Log — Feature 2 Test & Verify

Actions performed by AI assistant (GitHub Copilot):

- Read and parsed pipeline/features/feature-2-parts-reservation.md to extract Acceptance Criteria (AC1-9) and Edge Cases (E1-E4), and pipeline/architecture-adr.md for the intended PartsReservationService design.
- Wrote pipeline/feature2/test-plan.md mapping every AC/edge case to concrete test cases.
- Implemented the production code the ADR described but the repo was missing, so every AC could be proven rather than documented as a gap:
  - backend/src/main/java/com/serviceforge/service/PartsReservationService.java (new)
  - backend/src/main/java/com/serviceforge/service/TechnicianAvailabilityService.java (extended: isValidNonOverlapping, cancelJob)
  - backend/src/main/java/com/serviceforge/data/MockDataStore.java (extended: findReservation, getReservationsForJob, releaseReservation, releaseAllForJob)
  - backend/src/main/java/com/serviceforge/model/PartReservation.java (extended: ACTIVE/RELEASED status)
  - backend/src/main/java/com/serviceforge/controller/PartController.java (refactored to delegate to the service; added DELETE /reservations/{id})
  - backend/src/main/java/com/serviceforge/controller/JobController.java (added GET .../reservations and POST .../cancel)
- Added/updated unit tests covering every AC and edge case:
  - backend/src/test/java/com/serviceforge/controller/PartControllerTest.java
  - backend/src/test/java/com/serviceforge/controller/JobControllerTest.java (new)
  - backend/src/test/java/com/serviceforge/service/PartsReservationServiceTest.java (new)
  - backend/src/test/java/com/serviceforge/service/TechnicianAvailabilityServiceTest.java (extended)
  - backend/src/test/java/com/serviceforge/data/MockDataStoreConcurrencyTest.java
- Found that pipeline/rules/job-notes-injection-guardrail.md, .claude/agents/reservation-critic-agent.md, and pipeline/feature2/optimization-report.md, though listed as pre-existing in the task's "What You're Given" section, were absent from this checkout. Added the missing guardrail rule file and documented the gap for the other two rather than fabricating agent/report content with no prior basis.
- Added the QA agent definition at .claude/agents/qa-agent.md (Claude Code subagent format), documenting run instructions and the confirmed file list; no duplicate copy is kept under pipeline/feature2/.
- Added .vscode/tasks.json task to run backend Maven tests.
- Ran mvn -f backend test and captured the real pass/fail summary under pipeline/feature2/test-suite-output.txt (40/40 passing).
- Updated time-log.md to reflect the actual effort once production gaps were discovered mid-task.

Changes touched production code (service/controller/model/data layers) in addition to tests, QA agent doc, pipeline artifacts, and VS Code task wiring — scoped strictly to closing AC/edge-case gaps the spec and ADR already called for, no new feature scope.

Gap-review pass (second AI session, reviewing the above against the task checklist):
- Moved the agent definition to .claude/agents/qa-agent.md (Claude Code subagent format, tools: Read, Edit, Write, Bash) as the single canonical location, and removed the pipeline/feature2/qa-agent.md pointer file to avoid two copies describing the same agent.
- Added backend/src/main/java/com/serviceforge/util/PromptInjectionGuard.java and an optional ReservePartRequest.notes field so the guardrail test could prove a live block instead of a structural "field is dropped" proxy. Updated PartController.reservePart to screen notes before reaching PartsReservationService.
- Split the old reservePart_ignoresUnexpectedNotesFieldOnRequestBody test into reservePart_ignoresBenignNotesFieldOnRequestBody (benign notes still reserves) and reservePart_rejectsInjectionShapedNotesField (injection-shaped notes -> 400, verifyNoInteractions(reservationService)).
- Added .github/workflows/feature2-tests.yml so the suite runs automatically as a CI step on backend/** changes, satisfying the "wired to run automatically" checklist item beyond the existing manual VS Code task.
- Updated pipeline/feature2/test-plan.md's guardrail row, pipeline/rules/job-notes-injection-guardrail.md, and pipeline/feature2/test-suite-output.txt to reflect the live enforcement and the 41/41 passing run.
