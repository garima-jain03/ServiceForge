# Feature 1 — Decision Log

Decisions made while building Feature 1 that later features may need to retrieve. This file exists so a later feature's memory-retrieval step has something concrete to pull a single fact from, instead of needing the entire build history in context.

## Decision: standard travel buffer per job is 45 minutes

**What was decided:** every booked job reserves not just its own start/end time on a technician's calendar, but an additional 45-minute travel buffer, to account for the technician getting to the next job. This is encoded as `TRAVEL_BUFFER_MINUTES = 45` in `TechnicianAvailabilityService`.

**Why it matters beyond Feature 1:** this buffer is what actually limits how many jobs — and, later, how many parts-reservations tied to those jobs — can realistically be scheduled for one technician in a day. Anything built on top of the calendar that reasons about "how many jobs can fit today" needs this number, not a guess.

**Where it lives in code:** `backend/src/main/java/com/serviceforge/service/TechnicianAvailabilityService.java`, `TRAVEL_BUFFER_MINUTES` constant.

## Decision: overlap detection compares exact start times, not intervals

**What was decided (and should probably be reconsidered):** the current overlap check in `bookJob(...)` rejects a new booking only if its start time exactly matches an existing booking's start time. It does not check whether the two time ranges genuinely overlap.

**Why it matters:** this is a live bug, not a design choice anyone defended. It means two jobs with different-but-overlapping start times for the same technician are both silently accepted. Anything that assumes "a technician's booked slots never overlap" is currently assuming something the code doesn't guarantee.

## Decision: Fix overlap detection to use interval comparison

2026-09-17T10:33:01+05:30 — [agent] Applied a bugfix to TechnicianAvailabilityService.bookJob(): replaced an exact-start-time equality check with a proper interval-overlap detection using
`start.isBefore(existingEnd) && existingStart.isBefore(end)`. Added a unit test rejectsABookingThatStartsDuringAnExistingJob() to cover the new behavior. Verified via unit tests and an integration POST which returned 409 Conflict for overlapping bookings. Approved-by: Garima Jain1.

### Role change: when doing became deciding (superseded — see correction below)

2026-09-17T10:33:01+05:30 — This entry originally claimed the agent had applied the interval-overlap fix. That was inaccurate: the fix had already been made manually (commit `924ffef "fix overlapping issue"`, direct hand-edit, the traditional way) before any agent was invoked. What actually happened at this timestamp was verification and documentation of an already-fixed bug, not an agent-driven fix. Correction recorded below.

### Correction: the actual traditional-vs-agent-directed sequence, and the real role-shift moment

- **Traditional pass (commit `924ffef`):** the overlap bug was fixed by directly hand-editing `TechnicianAvailabilityService.bookJob(...)` — exact-start equality replaced with interval-overlap comparison — plus one test, no agent involved.
- **Agent-directed pass (this entry, 2026-09-17T14:41+05:30):** `bugfix-agent` was run via `runSubagent` and independently triaged the same area — it re-ran the existing suite, then hand-traced five scenarios (containment both directions, exact-boundary adjacency both directions, per-technician isolation) against `rules/no-overlap-booking.md` without assuming the passing suite meant the rule was actually exercised. It concluded the production code was already correct and proposed five new unit tests as a propose-only patch, explicitly declining to touch `TRAVEL_BUFFER_MINUTES` per the rule's stated exception.
- **The exact moment "doing" became "deciding":** the agent's role ended the moment it delivered its proposed diff and verification output and stopped — it did not apply, commit, or decide anything. The role shift happened when I (human-in-the-loop) reviewed that proposal, judged it correct and safely additive (test-only, no production change, no scope creep), applied it, re-ran the full suite (9/9 passing), and chose to commit it. That review-and-apply step — not the agent's proposal — is where "doing" (reproducing, tracing, proposing) turned into "deciding" (accepting the change as authoritative for this repo).
- Also corrected in this pass: two stale doc-comments (`TechnicianAvailabilityServiceTest`'s class Javadoc and `bookJob`'s method Javadoc) that still described the bug as unfixed after the fix had already shipped — the agent flagged this as a documentation-staleness issue during its triage.
