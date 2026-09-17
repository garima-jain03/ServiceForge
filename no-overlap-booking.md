# No-Overlap Booking — Problem Brief

Short description
- Tickets and users report that the technician calendar currently allows two jobs for the same technician whose time ranges overlap (for example, an existing job 09:00–11:00 and a new booking starting at 10:00). This violates the feature contract for Technician Availability and causes schedule conflicts.

Why this matters
- Overlapping bookings break scheduler assumptions (a technician cannot be in two places at once), can cascade into dispatch and parts allocation errors, and erode trust in the booking system.

Current behavior (observed)
- TechnicianAvailabilityService.bookJob(...) currently rejects only exact start-time matches and therefore allows genuine interval overlaps.
- The controller maps IllegalStateException to HTTP 409 Conflict; that mapping should remain unchanged.

Constraints and guardrails
- No database/schema changes — the system uses an in-memory MockDataStore; maintain model shapes.
- Preserve public API behavior: do not change exception types used for conflict detection or their HTTP mapping unless a separate, documented decision is made.
- Do not enable travel-buffer enforcement (TRAVEL_BUFFER_MINUTES = 45) as part of this change unless the business explicitly asks — that is a higher-risk decision.

Success indicators
- Unit tests demonstrating overlapping start-times are rejected (new test exists and passes).
- Integration checks: POSTing a non-overlapping job returns 201 Created; POSTing an overlapping job returns 409 Conflict with a clear ApiError message.

References
- pipeline/features/feature-1-technician-availability.md
- pipeline/decisions/feature-1-decisions.md
- backend/src/main/java/com/serviceforge/service/TechnicianAvailabilityService.java

