# Implementation Plan — Feature 2: Parts Reservation

Built from `pipeline/architecture-adr.md`. This is the map `developer-agent` and `tester-agent` execute against; it does not restate the spec's acceptance criteria (`pipeline/features/feature-2-parts-reservation.md`), only how the work is broken up.

Effort scale: **S** = a few focused edits, single file/class. **M** = a new class plus its wiring and a test. **L** = touches multiple layers or has non-trivial edge-case logic.

## Components / tasks

| # | Task | Layer | Depends on | Effort | Notes |
|---|---|---|---|---|---|
| 1 | `Part` model | `model` | none | S | id, name, quantityOnHand — plain data class matching `Technician`/`Job` style |
| 2 | `PartReservation` model | `model` | none | S | id, jobId, partId, quantity, status (ACTIVE/RELEASED) |
| 3 | `MockDataStore` extension | `data` | 1, 2 | M | additive: `parts` + `partReservations` lists, id sequences, seed data (per `migration-safety-skill` — seed must populate every field) |
| 4 | `ApiError`-based 404/409 responses | `dto` | none | S | reuse existing `ApiError` (already in `dto/`) — no new error type |
| 5 | `PartsReservationService.reserve()` | `service` | 1–4, Feature 1's `TechnicianAvailabilityService` | **L** | the core logic: live re-check of job validity (spec D1/E4), stock check + decrement inside a `synchronized` critical section (ADR §1/§2), reject-whole-on-insufficient-stock (spec A1) |
| 6 | `PartsReservationService.listForJob()` | `service` | 3 | S | filter non-released reservations by jobId |
| 7 | `PartsReservationService.release()` | `service` | 3 | M | restore `quantityOnHand`, mark RELEASED, 404 if reservation missing/already released |
| 8 | `PartsReservationService.releaseAllForJob()` | `service` | 7 | S | reused by both explicit release and job-cancellation hook |
| 9 | Hook into job cancellation | `service`/`controller` | 8, existing `JobController`/`Job` cancel path | M | wherever `JobStatus` transitions to cancelled, call `releaseAllForJob` in the same request — no async/event bus (ADR data-flow section) |
| 10 | `PartsController` | `controller` | 5–8 | M | `POST /api/jobs/{jobId}/reservations`, `GET /api/jobs/{jobId}/reservations`, `DELETE /api/reservations/{id}` — `ResponseEntity<T>` + `ApiError` per `build-code-skill` |
| 11 | Backend tests | `test` | 5–10 | **L** | one test per Definition-of-Done item (spec SM-1) — includes the concurrency test for E1 (SM-5) and the live-recheck test for E4 (SM-4); this is `tester-agent`'s job, listed here only for dependency mapping |
| 12 | Frontend models | `frontend/models` | 10 (contract) | S | `part.model.ts`, `part-reservation.model.ts` mirroring backend DTOs |
| 13 | Frontend service | `frontend/services` | 12 | S | `parts-reservation.service.ts`, HTTP calls only, `environment.apiBaseUrl` base |
| 14 | Frontend UI | `frontend/app` | 13 | M | reserve/list/release affordance on the existing job view — component renders + delegates, no HTTP in the component |

## Dependency graph (build order)

```
1,2 → 3 → {5,6,7} → 8 → 9
                  ↘ 10 → 11
10 → 12 → 13 → 14
```

Backend (1–11) has no hard dependency on frontend work (12–14); they can proceed in parallel once task 10's contract (request/response shape) is fixed, but task 10 must be implemented (or at minimum its DTO shapes decided) before frontend work starts, per `build-code-skill`'s "no business logic in components" — the frontend service needs a real contract to call, not a guess.

## High-risk areas (flag for extra test attention)

- **Task 5 (concurrency)** — this is the ADR's flagged riskiest decision. `tester-agent` must write the two-simultaneous-requests test (spec E1/SM-5) against the actual `synchronized` implementation, not a mocked stub, or the risk is untested.
- **Task 9 (cancellation hook)** — easy to implement in one job-cancellation code path and miss another if `JobStatus` can transition to cancelled from more than one place. Grep all call sites that set a cancelled status before considering this done (same discipline as `migration-safety-skill`'s "checked against every consumer").
- **Task 5 (live re-check, E4)** — a caching optimization added later (e.g., memoizing job validity) would silently break this; call this out in code comments at the call site, not just here.

## Definition-of-Done traceability

Every numbered task above maps to one or more of the Feature 2 spec's Acceptance Criteria (AC-1 through AC-9) and Success Metrics (SM-1 through SM-5); this plan does not introduce any task without a corresponding spec item, and does not omit any spec item from a task. `tester-agent` verifies this mapping is actually true at test time, per `pipeline/orchestration.md`'s existing role definition — no new verification step is added here.

## References

- `pipeline/architecture-adr.md`
- `pipeline/features/feature-2-parts-reservation.md`
- `.claude/skills/build-code-skill/SKILL.md`, `.claude/skills/migration-safety-skill/SKILL.md`
