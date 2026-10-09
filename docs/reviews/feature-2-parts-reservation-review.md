# Review Report: feature-2-parts-reservation

Checklist source: `.claude/rules/review-checklist-rule.md`

## 1) Jira AC verification

- AC-1 create reservation returns `201 Created` and is retrievable: Pass. `PartController.reservePart` exposes `POST /api/parts/{sku}/reservations`, accepts `ReservePartRequest.jobId` and `quantity`, returns `201 Created` with `PartReservation`, and `PartsReservationService.reserve` checks job existence/live validity before calling `MockDataStore.reservePart`. Covered by `PartControllerTest.reservePart_returns201ForExistingJobAndSufficientStock` and `PartsReservationServiceTest.reserve_succeedsForValidScheduledJobWithSufficientStock`.
- AC-2 nonexistent job returns `404` with `ApiError`: Pass. `PartsReservationService.reserve` throws `IllegalArgumentException` when `MockDataStore.findJob(jobId)` is empty, and `PartController.reservePart` maps that to `404` with `ApiError`. Covered by `PartControllerTest.reservePart_returns404ForUnknownJob` and `PartsReservationServiceTest.reserve_throwsForUnknownJob`.
- AC-3 invalid/overlapping job returns `409` with `ApiError` on create: Pass. `PartsReservationService.reserve` calls `TechnicianAvailabilityService.isValidNonOverlapping(jobId)` and throws `IllegalStateException` for an invalid scheduled target; `PartController.reservePart` maps that to `409` with `ApiError`. Covered by `PartControllerTest.reservePart_returns409WhenJobSlotIsInvalid`, `PartsReservationServiceTest.reserve_throwsWhenJobIsCancelled`, and `PartsReservationServiceTest.reserve_throwsWhenJobSlotOverlapsAnotherBookingForSameTechnician`.
- AC-4 insufficient stock returns `409` and reserves nothing: Pass. `MockDataStore.reservePart` rejects insufficient stock before creating a reservation or decrementing stock, and `PartController.reservePart` maps that to `409` with `ApiError`. Covered by `PartControllerTest.reservePart_returns409WhenInsufficientStock` and `PartsReservationServiceTest.reserve_throwsWhenQuantityExceedsStock`.
- AC-5 list job reservations: Pass. `JobController.getReservations` returns `ResponseEntity.ok(reservationService.listForJob(jobId))`, and `MockDataStore.getReservationsForJob` filters active reservations for that job. Covered by `JobControllerTest.getReservations_returnsEmptyListForJobWithNone`, `JobControllerTest.getReservations_returnsActiveReservationsForJob`, and `PartsReservationServiceTest.listForJob_returnsActiveReservationsForThatJobOnly`.
- AC-6 delete existing reservation returns `204` and restores stock: Pass. `PartController.releaseReservation` maps successful `PartsReservationService.release` to `204 No Content`; `MockDataStore.releaseReservation` flips status and restores stock. Covered by `PartControllerTest.releaseReservation_returns204WhenReleased` and `PartsReservationServiceTest.release_restoresStockAndRemovesFromJobsList`.
- AC-7 delete unknown or released reservation returns `404`: Pass. `PartsReservationService.release` throws `IllegalArgumentException` when `MockDataStore.releaseReservation` returns false for unknown or already released reservations, and `PartController.releaseReservation` maps that to `404` with `ApiError`. Covered by `PartControllerTest.releaseReservation_returns404WhenNotFound`, `PartsReservationServiceTest.release_throwsForUnknownReservation`, and `PartsReservationServiceTest.release_throwsWhenAlreadyReleased`.
- AC-8 cancelling a job releases reservations: Pass. `JobController.cancelJob` calls `availabilityService.cancelJob(jobId)` and then `reservationService.releaseAllForJob(jobId)` in the same request path. Covered by `JobControllerTest.cancelJob_releasesAllReservationsForThatJob` and `PartsReservationServiceTest.cancellingAJob_releasesAllItsReservationsAndRestoresStock`.
- AC-9 concurrent reservation does not over-reserve: Pass. `MockDataStore.reservePart` is synchronized and performs check-and-decrement in the same critical section, preventing negative stock under concurrent reservation attempts. Covered by `MockDataStoreConcurrencyTest.concurrentReserve_onlyOneSucceedsAgainstSingleUnit`.
- E4 live validity check on every reservation read or mutation: Fail. The spec requires any reservation read or mutation, including list and delete, to re-run Feature 1's current overlap check before trusting the job as a valid reservation target. `PartsReservationService.reserve` performs this check, but `PartsReservationService.listForJob` directly returns `dataStore.getReservationsForJob(jobId)`, and `PartsReservationService.release` directly calls `dataStore.releaseReservation(reservationId)` without checking the reservation's job validity through `TechnicianAvailabilityService.isValidNonOverlapping`. No listed test covers invalid-overlap behavior for `GET /api/jobs/{jobId}/reservations` or `DELETE /api/parts/reservations/{reservationId}`.
- QA evidence supports acceptance criteria: Pass. `pipeline/feature2/test-suite-output.txt` reports `Tests run: 41, Failures: 0, Errors: 0, Skipped: 0`, including `PartControllerTest`, `JobControllerTest`, `MockDataStoreConcurrencyTest`, `PartsReservationServiceTest`, and `TechnicianAvailabilityServiceTest`.

## 2) Quality audit

- Controllers limited to orchestration: Pass. `PartController` maps HTTP requests to `PartsReservationService` and `MockDataStore.findPart`, handles guardrail screening, and converts service exceptions into status codes; `JobController` delegates booking/cancellation to `TechnicianAvailabilityService` and reservation release/listing to `PartsReservationService`.
- Services encapsulate business rules: Pass. `PartsReservationService.reserve` owns job existence and live schedule validity checks; `TechnicianAvailabilityService.isValidNonOverlapping` owns interval-overlap validation; `MockDataStore.reservePart` owns atomic in-memory stock mutation.
- DTOs are simple POJOs: Pass. `ReservePartRequest` contains private fields, validation annotations, and getters/setters for `jobId`, `quantity`, and optional `notes`.
- Method names are descriptive and unambiguous: Pass. `reserve`, `listForJob`, `release`, `releaseAllForJob`, `isValidNonOverlapping`, `reservePart`, and `releaseReservation` describe their responsibilities clearly.
- Models avoid public mutable fields: Pass. `Part` and `PartReservation` use private fields with getters; `Part.quantityOnHand` and `PartReservation.status` are mutable only through setter or `release()`.
- Backend package and DI conventions: Pass. Implementation uses package-by-layer layout under `model`, `data`, `service`, `controller`, and `dto`; backend dependencies are constructor-injected in `PartController`, `JobController`, `PartsReservationService`, and `TechnicianAvailabilityService`; REST endpoints return `ResponseEntity<?>`.

## 3) Security review

- External input validation exists for the reservation request body: Pass. `ReservePartRequest.jobId` is `@NotNull`, `quantity` is `@Min(1)`, and `PartController.reservePart` uses `@Valid @RequestBody ReservePartRequest`.
- Bad domain input returns `ApiError`: Pass. Unknown job and unknown reservation map to `404` with `ApiError`; invalid job slot and insufficient stock map to `409` with `ApiError`; suspicious `notes` maps to `400` with `ApiError`.
- Bean-validation failures return `ApiError`: Needs Human Decision. Bean-validation failures for malformed request bodies rely on Spring MVC's default validation handling rather than an explicit repository-local `ApiError` handler. No `@ControllerAdvice` or `MethodArgumentNotValidException` handler was found under `backend/src/main/java`; if the repository requires every `400` to use `{ "message": "..." }`, a global validation exception mapper is needed. This is a pre-existing convention risk exposed by the new validated DTO, not direct evidence that Feature 2 domain paths return the wrong body.
- Prompt-injection guardrail: Pass. `PartController.reservePart` screens `ReservePartRequest.notes` with `PromptInjectionGuard.isSuspicious` before calling `PartsReservationService`; `PromptInjectionGuard.DEFAULT_PATTERNS` matches `pipeline/rules/guardrails-config.json` prompt-injection patterns. Covered by `PartControllerTest.reservePart_rejectsInjectionShapedNotesField` with `verifyNoInteractions(reservationService)`.
- No unsafe deserialization: Pass. The changed code uses Spring JSON binding into a simple DTO and does not introduce custom deserializers, polymorphic object binding, file loading, or reflection-based parsing.
- No new external dependency: Pass. `backend/pom.xml` contains Spring Boot web, validation, and test dependencies only; no database, auth, queue, or external service dependency was introduced.
- Secrets-scan hook reported clean for this diff: Pass. Orchestrator-provided PreToolUse hook evidence for the clean diff was `[{"file":"feature-2-clean-diff","exitCode":0,"stderr":""}]`, so all relevant files passed with exit code `0` and no stderr matches.

## 4) Compliance

- `pipeline/rules/no-overlap-booking.md`: Pass. `TechnicianAvailabilityService.bookJob` and `TechnicianAvailabilityService.isValidNonOverlapping` use interval intersection semantics, `startA < endB && startB < endA`, and exact-boundary adjacency remains allowed. Covered by `TechnicianAvailabilityServiceTest`.
- `pipeline/rules/memory-retention-for-reservations.md`: Fail. The active rule requires every successful reservation and release to call the repository memory write hook with namespace `serviceforge:parts:reservations` or a feature-scoped namespace. The reviewed backend implementation files contain no `postTurnHook`, `writeMemory`, `serviceforge:parts:reservations`, or `serviceforge:feature-2` call in `PartController`, `PartsReservationService`, or `MockDataStore`. This violates the rule's explicit "Where to apply" entry for backend `PartController`.
- `pipeline/rules/job-notes-injection-guardrail.md`: Pass. `ReservePartRequest` carries optional `notes`, `PartController.reservePart` screens it through `PromptInjectionGuard`, suspicious text returns `400`, benign notes are not persisted or echoed, and tests cover both suspicious and benign cases.
- Migration safety: Pass. Feature 2 adds new `Part` and `PartReservation` models and additive `MockDataStore` lists/sequences without renaming or removing existing `Technician`, `Job`, or `JobStatus` fields. Seed data populates the new `parts` list. Existing job-status consumer behavior remains intact.

## 5) Design alignment

- ADR data model: Pass. Implementation adds `Part` and `PartReservation` under `com.serviceforge.model`, stores them additively in `MockDataStore`, and keeps references flat by `sku` and `jobId`, consistent with the ADR's flat in-memory model approach.
- ADR live Feature 1 dependency for create: Pass. `PartsReservationService` constructor-injects `TechnicianAvailabilityService` and calls the live validity check for reservation creation instead of duplicating the interval-overlap formula.
- ADR synchronized critical section placement: Needs Human Decision. The ADR records coarse-grained `synchronized` in `PartsReservationService`, while the implementation places synchronized check-and-mutate methods in `MockDataStore.reservePart`, `releaseReservation`, and `releaseAllForJob`. This still provides a single-JVM, in-memory critical section with no new infrastructure, but it diverges from the ADR wording.
- ADR no new infrastructure: Pass. Implementation uses in-memory `MockDataStore` only and introduces no database, queue, distributed lock, or external service.
- ADR live re-check on every reservation read/write: Fail. The ADR states Feature 2 calls Feature 1's live overlap logic on every reservation read/write, and spec E4 names list, delete, and future edit as reads/mutations that must re-run the check. Implementation only re-checks in `PartsReservationService.reserve`; `listForJob` and `release` do not call `TechnicianAvailabilityService.isValidNonOverlapping`.

## Machine-readable summary

```json
{
	"Jira AC verification": {
		"AC1 create reservation returns 201 and is retrievable": "Pass",
		"AC2 unknown job returns 404 ApiError": "Pass",
		"AC3 invalid job slot returns 409 ApiError on create": "Pass",
		"AC4 insufficient stock returns 409 and reserves nothing": "Pass",
		"AC5 list job reservations": "Pass",
		"AC6 delete reservation returns 204 and restores stock": "Pass",
		"AC7 delete unknown or released reservation returns 404": "Pass",
		"AC8 cancel job releases reservations": "Pass",
		"AC9 concurrent reservation does not over-reserve": "Pass",
		"E4 live validity check on every reservation read or mutation": "Fail",
		"QA evidence supports acceptance criteria": "Pass"
	},
	"Quality audit": {
		"Controllers limited to orchestration": "Pass",
		"Services encapsulate business rules": "Pass",
		"DTOs are simple POJOs": "Pass",
		"Method names descriptive": "Pass",
		"No public mutable model fields": "Pass",
		"Backend package and DI conventions": "Pass"
	},
	"Security review": {
		"External input validation": "Pass",
		"Domain bad input returns ApiError": "Pass",
		"Bean validation failures return ApiError": "Needs Human Decision",
		"Prompt injection guard": "Pass",
		"No unsafe deserialization": "Pass",
		"No new external dependency": "Pass",
		"Secrets-scan hook reported clean for this diff": "Pass"
	},
	"Compliance": {
		"RULE-001 no-overlap booking": "Pass",
		"RULE-MEM-001 memory retention for reservations": "Fail",
		"Job-notes injection guardrail": "Pass",
		"Migration safety": "Pass"
	},
	"Design alignment": {
		"ADR data model": "Pass",
		"ADR live Feature 1 dependency for create": "Pass",
		"ADR synchronized critical section placement": "Needs Human Decision",
		"ADR no new infrastructure": "Pass",
		"ADR live re-check on every reservation read/write": "Fail"
	}
}
```

## Final verdict

No-Ship — Feature 2 is close, and the passing QA run covers the core happy/error paths, but the implementation misses the spec/ADR requirement to re-run Feature 1 validity on reservation list/delete paths and violates the active memory-retention rule for successful reservation/release operations.
