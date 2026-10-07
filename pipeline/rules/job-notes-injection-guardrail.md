# Rule — Job-Notes Injection Guardrail

## Status
This rule file did not exist in the checkout this Feature 2 work was built against, despite
being listed as a carried-forward B4 pipeline artifact. It is added here to close that gap and
give the Feature 2 "security/bypass" test plan row a real rule to trace to.

## Rule
Any request path that could carry free-text content originating from a job (e.g., a future
`notes` field on `Job` or a reservation request) must never let that text be interpreted as
instructions, reach business logic unsanitized, or be echoed back verbatim in a response. The
canonical detector for known injection patterns is `tools/guardrails/enforcer.js`'s
`detectPromptInjection(text)`, configured by `pipeline/rules/guardrails-config.json`'s
`promptInjectionPatterns` (e.g. `"ignore prior"`, `"ignore previous"`, `"ignore instructions"`,
`"refund $"`).

## Current state in this repo
- `ReservePartRequest` (`backend/src/main/java/com/serviceforge/dto/ReservePartRequest.java`)
  now carries an optional `notes` field. It is never persisted or forwarded to
  `PartsReservationService` / `MockDataStore` — it only exists to be screened.
- `PartController.reservePart` screens `notes` through
  `backend/src/main/java/com/serviceforge/util/PromptInjectionGuard.java` (a Java port of
  `detectPromptInjection`, patterns kept in sync with `guardrails-config.json`) before doing
  anything else. A match returns `400` and the request never reaches the reservation service.
- `PartControllerTest.reservePart_rejectsInjectionShapedNotesField` proves the live block: an
  injection-shaped `notes` value is rejected with 400 and `verifyNoInteractions(reservationService)`
  confirms it never reached business logic.
- `PartControllerTest.reservePart_ignoresBenignNotesFieldOnRequestBody` proves the negative case:
  a non-matching `notes` value does not block a legitimate reservation.

## If the patterns list changes
If `pipeline/rules/guardrails-config.json`'s `promptInjectionPatterns` changes, update
`PromptInjectionGuard`'s `DEFAULT_PATTERNS` to match — the two lists are maintained in parallel,
not read from the same file at runtime, because the JSON config is consumed by the Node-based
`tools/guardrails/enforcer.js`, not by the backend JVM.
