# Feature 2 — Parts Reservation

| Field | Value |
|---|---|
| **Status** | Candidate-built / in progress |
| **One-line intent** | Let a technician's scheduled job hold a reservation against mock parts inventory so the technician arrives with the parts the job needs |
| **Depends on** | Feature 1's "Fix overlap detection to use interval comparison" decision (`pipeline/decisions/feature-1-decisions.md`) — reservations are only valid against a job whose slot passed interval-overlap validation, i.e. `start.isBefore(existingEnd) && existingStart.isBefore(end)` found no conflict — and Feature 1's "standard travel buffer per job is 45 minutes" decision (`TRAVEL_BUFFER_MINUTES = 45` in `TechnicianAvailabilityService`), which bounds how many jobs, and therefore how many parts-reservations, a technician can realistically be booked for in one day |
| **In scope** | Reserving one or more parts (by part id + quantity) against an existing, successfully-booked job; listing the reservations attached to a job; releasing (deleting) a reservation; rejecting a reservation if the underlying job no longer holds a valid, non-overlapping slot; rejecting or partially fulfilling a reservation when requested quantity exceeds available mock stock |
| **Out of scope** | Inventory replenishment, purchase orders, supplier/vendor integration, low-stock alerting or reorder thresholds, part substitution logic, and any UI/workflow for technicians to consume or check off parts on-site — all of that is later feature territory, not this one |
| **Definition of Done** | (1) A reservation can be created against a `SCHEDULED`, non-overlapping job and is stored in memory linked to that job; (2) reserving against a nonexistent job returns 404; (3) reserving against a job whose slot fails Feature 1's interval-overlap check returns 409; (4) reserving a quantity greater than mock stock-on-hand for a part returns 409 (or a defined partial-fulfillment response — see Acceptance Criteria) rather than silently over-reserving; (5) a job's reservations can be listed; (6) a reservation can be deleted and no longer appears in that job's reservation list; (7) cancelling a job automatically releases all reservations tied to it |

## Narrative

Feature 1 lets a job be booked onto a technician's calendar with a validated, non-overlapping slot. This feature adds a second in-memory concept — a **Part** (id, name, quantity on hand) and a **PartReservation** (id, job id, part id, quantity reserved, status) — and lets a dispatcher or the system itself hold parts against a job before the technician is dispatched, so the technician doesn't arrive short a component the job needs.

## User stories

- **US-1 (Dispatcher):** As a dispatcher, I want to reserve the parts a job requires as soon as the job is booked, so the technician is guaranteed to have what they need before I dispatch them.
- **US-2 (Technician):** As a technician, I want to see which parts are reserved against my scheduled job, so I know what to load before I leave for the appointment.
- **US-3 (Operator):** As an operator, I want to release a reservation I made in error (wrong part, wrong quantity) without needing to cancel the whole job, so correcting a mistake doesn't disrupt the technician's schedule.
- **US-4 (The system):** As the system, I want to automatically release every reservation tied to a job the moment that job is cancelled, so parts aren't held against work that will never happen.

## Acceptance criteria

1. `POST` a reservation request (part id, quantity) against an existing job whose slot is `SCHEDULED` and non-overlapping returns `201 Created` with the new reservation, and the reservation is retrievable afterward via the job's reservation list.
2. `POST` a reservation request against a job id that does not exist in `MockDataStore` returns `404 Not Found` with an `ApiError` body, and no reservation is created.
3. `POST` a reservation request against a job whose booked slot fails Feature 1's interval-overlap check (i.e., the job itself was never validly booked, or has since been superseded by a conflicting booking) returns `409 Conflict` with an `ApiError` body, and no reservation is created.
4. `POST` a reservation request for a quantity greater than the part's current stock-on-hand returns `409 Conflict` and reserves nothing — no reservation is created for any partial amount unless the caller explicitly requests partial fulfillment (see Edge Case E3), in which case the response must state the quantity actually reserved versus the quantity requested.
5. `GET` a job's reservations returns every non-released reservation currently linked to that job, and an empty list (not an error) for a job with none.
6. `DELETE` an existing reservation returns `204 No Content`, and that reservation no longer appears in a subsequent `GET` of the job's reservations; the part's stock-on-hand is restored by the released quantity.
7. `DELETE` a reservation id that does not exist (or was already released) returns `404 Not Found`.
8. Cancelling a job (transition to a cancelled `JobStatus`) automatically releases every reservation linked to that job in the same operation — no separate call is required, and the parts' stock-on-hand is restored.
9. Two reservation requests submitted for the same part where the combined quantity exceeds stock-on-hand must not both succeed in full: the second request to be processed is the one that receives the 409/partial-fulfillment response from Acceptance Criterion 4, not an over-reservation that leaves stock negative.

## Edge cases

- **E1 — Concurrent reservation conflict:** Two reservation requests for the same part arrive at (or near) the same time, and their combined quantity exceeds stock-on-hand. The service must serialize the check-and-decrement against `MockDataStore` so exactly one ordering wins; the loser gets the 409/partial response from AC-4, and stock-on-hand never goes negative. (This is the parts-inventory analogue of Feature 1's original overlap bug — the fix must not repeat the "check without a real interval/atomic guard" mistake that Feature 1 shipped and had to correct.)
- **E2 — Job cancellation after reservation:** A job has one or more active reservations, then the job is cancelled. All reservations tied to that job must be released automatically as part of the cancellation, and the associated parts' stock-on-hand must be restored — a reservation must never be left "active" against a job that no longer exists in a bookable state.
- **E3 — Partial part availability:** A reservation requests a quantity greater than what's currently on hand (e.g., 5 requested, 3 in stock). The spec requires the API to either (a) reject the whole request with 409 and reserve nothing, or (b) reserve the available 3 and clearly report `requestedQuantity: 5, reservedQuantity: 3` in the response — the developer agent must pick one behavior and it must be consistent and documented in code, not silently mixed. Default assumption for this spec: **behavior (a), reject and reserve nothing**, since silent partial fulfillment risks a technician believing they have parts they don't; a human should confirm this before Feature 3 builds on it (see Explicit Assumption below).
- **E4 — Re-validation against Feature 1's no-overlap rule:** A job was validly booked (passed interval-overlap validation) at the time a reservation was made, but a later code path or data correction causes that same job's slot to become overlapping with another booking for the same technician (for example, a bug reintroduces the old exact-start-time check, or a booking is edited outside the normal API). Any reservation *read* or *mutation* (list, delete, or a future edit) must not assume the job's validity is still true — reservation logic must re-run Feature 1's current overlap check (not a cached result from creation time) before trusting the job as a valid reservation target.

## Explicit dependencies on Feature 1

- **D1 — Interval-overlap validation is the gate, not a formality.** Feature 2 relies on `TechnicianAvailabilityService`'s current interval-overlap check (`start.isBefore(existingEnd) && existingStart.isBefore(end)`, per the 2026-09-17 fix recorded in `pipeline/decisions/feature-1-decisions.md`) as the authoritative test for "is this job a valid target for a reservation." **If Feature 1 changes this check** — reverts to exact-start-time comparison, or changes the comparison operators — Feature 2's AC-3 and E4 both silently stop being enforced, and reservations could be held against jobs that never should have been bookable in the first place. Any change to that check must be accompanied by a review of this feature's reservation-validation code path.
- **D2 — The 45-minute travel buffer bounds daily reservation volume.** Feature 2 does not encode the `TRAVEL_BUFFER_MINUTES = 45` value itself, but any reporting or projection this feature (or a later one) builds on top of "how many parts-reservations can a technician realistically carry in a day" must use Feature 1's travel-buffer-adjusted job count, not a raw job count. **If Feature 1 changes this constant**, any such projection built on Feature 2's data becomes wrong until it's recalculated against the new value.
- **D3 — Job existence and `JobStatus` are owned by Feature 1.** Feature 2 never creates, edits, or owns a `Job` — it only reads job existence and status from Feature 1's model (`Job.java`, `JobStatus.java`) to decide whether a reservation request is valid and to detect cancellation (US-3 / E2). **If Feature 1 renames or restructures `JobStatus`** (e.g., removes or renames the "cancelled" state), Feature 2's automatic-release-on-cancellation behavior breaks silently unless it's updated in the same change — per the migration-safety-skill rule on checking every consumer of a model before considering a model change done.

## Success metrics

- **SM-1:** 100% of the numbered Acceptance Criteria above have at least one passing automated test (unit or integration) in the tester agent's suite.
- **SM-2:** A seeded job with a seeded part can be reserved end-to-end via the API (`POST` reservation → `201`, `GET` job reservations → contains it, `DELETE` reservation → `204`, `GET` again → empty) with no manual data patching required.
- **SM-3:** A test that cancels a job with an active reservation asserts the reservation is gone from `GET` and the part's stock-on-hand is restored to its pre-reservation value — proving E2 is enforced, not just documented.
- **SM-4:** A test that reserves against a job engineered to fail Feature 1's current interval-overlap check asserts a `409`, not a `201` — proving D1/E4 are enforced against the live check, not a value cached at booking time.
- **SM-5:** A test that issues two reservation requests whose combined quantity exceeds stock-on-hand asserts exactly one succeeds in full and stock-on-hand never goes negative — proving E1 is enforced.

## Assumptions requiring human confirmation

- **A1:** Per E3, this spec defaults to "reject the whole request and reserve nothing" when requested quantity exceeds stock-on-hand, rather than silent partial fulfillment. If partial fulfillment is actually wanted, correct this before the developer agent starts — it changes the response shape in AC-4.

## Artifacts this feature touches

<filled in as the developer and tester agents do their work>

---

## Review notes (human intervention log)

This spec was generated by running `ba-agent` (via `runSubagent`) against the raw intent "Parts Reservation," not written directly. Reviewed and annotated before commit:

- **Accepted as-is:** user stories, acceptance criteria 1–9, edge cases E1/E2/E4, all three Feature-1 dependencies (D1–D3), and success metrics SM-1–SM-5. The agent independently named Feature 1's exact decision content (interval-overlap formula, travel-buffer constant) rather than vaguely citing "the Feature 1 rule" — no correction needed there.
- **Intervention 1 — A1 (partial-fulfillment assumption):** the agent flagged E3's behavior choice (reject-whole vs. partial-fulfill) as needing human confirmation rather than picking silently. I am accepting its recommended default — **reject the whole request, reserve nothing** — as the correct call for a training boilerplate where "the technician thinks they have parts they don't" is the worse failure mode. This is a real decision, not a rubber stamp: if a later exercise wants partial fulfillment, it must explicitly override A1 here first.
- **Intervention 2 — file overwrite:** the agent could not overwrite my earlier draft of this same file directly (its `Write` tool only creates new files, matching this repo's convention of not editing specs out from under review). I reviewed its output, confirmed it superseded my earlier draft in every dimension the assignment asked for (it independently added the E1 concurrency edge case tied back to Feature 1's original bug, which my draft never had), and applied it myself.
- **What I did not change:** I did not add or remove any scope, endpoint design, or acceptance criteria beyond what the agent produced — this file is the agent's requirements output, reviewed, not rewritten.
