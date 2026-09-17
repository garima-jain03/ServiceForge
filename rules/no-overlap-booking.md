# Rule: No-Overlap Booking (repository rule)

Rule ID: RULE-001

Intent
- Ensure the repository enforces a single-source-of-truth rule that technician job ranges may not overlap. This is a programmatic rule and a team convention: any change that affects booking conflict detection must preserve non-overlap semantics unless a documented rule change is approved.

Enforcement
- All booking checks must use interval intersection semantics: startA < endB && startB < endA.
- Any change that relaxes this rule (for example to allow travel buffers or overlapping schedules) requires:
  - An explicit decision recorded under pipeline/decisions/ with rationale, rollback plan, and test coverage.
  - Sign-off from BA and Approver.

Where to apply
- backend/src/main/java/com/serviceforge/service/TechnicianAvailabilityService.java
- Any other service or helper that checks job conflicts for technicians

Why this rule
- Prevents accidental regressions like the exact-start equality bug.
- Makes scheduling behavior deterministic and auditable.

Exceptions
- Temporal adjacency (end == start) is allowed (not considered overlapping) by default; if business requires otherwise, the change must be documented and approved.

