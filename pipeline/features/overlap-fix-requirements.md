# No-Overlap Booking — BA Requirements (A3)

Feature context
- Feature: Technician Availability Calendar (Feature 1)
- Problem: the system must guarantee that a technician cannot be double-booked for overlapping job time ranges.

One-line intent
- Enforce non-overlap on bookings for the same technician: any attempt to create a job whose time range intersects an existing job for that technician must be rejected with a clear conflict error.

Scope (in)
- Backend booking flow: `TechnicianAvailabilityService.bookJob(...)` and `JobController.POST /api/jobs` behavior.
- Unit tests and minimal integration verification.

Scope (out)
- Travel buffer enforcement, route optimization, parts allocation, UI changes, and scheduling heuristics.

Requirements
- R1: Overlap detection must use interval intersection semantics. For two intervals [startA, endA) and [startB, endB), they overlap if startA < endB && startB < endA.
- R2: On conflict, the service must throw IllegalStateException (existing contract) and the controller must continue mapping it to HTTP 409 with an ApiError body.
- R3: Add deterministic unit tests to cover: exact-start conflict, start-inside-existing, starting-before-and-ending-during, and identical intervals.
- R4: Tests must use deterministic times seeded by MockDataStore.seed() where possible (avoid LocalDateTime.now() in assertions).
- R5: The fix must not change the Job or Technician model shapes or persistence approach (in-memory MockDataStore only).

Acceptance criteria
- A: All new and existing unit tests pass locally (`mvn test`).
- B: Integration verification: POST non-overlap → 201 Created; POST overlap → 409 Conflict with a helpful message.
- C: A decision note is appended to pipeline/decisions/feature-1-decisions.md recording the change, timestamp, and approver.

Verification steps
1. Run: `mvn -Dtest=TechnicianAvailabilityServiceTest test` — targeted tests should pass.
2. Run: `mvn test` — full test suite passes.
3. Start backend: `cd backend && mvn spring-boot:run` and run two POST requests: one non-overlapping (201) and one overlapping (409). Observe ApiError body.
4. Append decision note and commit.

Risks & mitigations
- Risk: Uncovered edge cases where jobs touching at end/start (end == start) may be considered overlapping differently. Mitigation: explicitly document that adjacent slots (end == start) are allowed and covered by the interval semantics above (the condition start < end excludes end==start overlaps).
- Risk: If later business requires travel buffer, this change must be extended carefully. Mitigation: keep buffer enforcement as a separate change with tests and decision recorded.

Stakeholders & approver
- BA: (TBD)
- Developer: Garima Jain1
- Approver: (human must provide name when approving the patch)

