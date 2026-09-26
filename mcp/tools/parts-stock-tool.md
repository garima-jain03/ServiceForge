# [TOOL] `reserve_part_for_job` — parts-stock tool contract

The one write-capable tool exposed by this MCP server. See
[../tool-design.md](../tool-design.md) for the full justification; this file is the contract a
host/model integrates against.

## When to use it

Use when the dispatcher has confirmed they want to hold stock for a specific job. Do **not**
use it to merely check stock — there is no read mode; every call is a real attempt to commit
inventory. Input is a `sku`, not a free-text part name — resolve the sku from the parts catalog
first if you only have a name like "compressor clutch".

## Input

| Field | Type | Required | Constraint |
|---|---|---|---|
| `sku` | string | yes | non-empty, must be a real ServiceForge part sku |
| `jobId` | integer | yes | `>= 1`, must be a real ServiceForge job id |
| `quantity` | integer | yes | `>= 1` |

No other fields are accepted (`additionalProperties: false`).

## Output — success

```json
{
  "reserved": true,
  "reservationId": 1,
  "sku": "CMP-CLUTCH",
  "jobId": 1,
  "quantity": 1
}
```

## Output — errors

Every error is returned as a single actionable text block (`isError: true`), never a raw HTTP
status or stack trace:

| Case | Trigger | Message shape |
|---|---|---|
| Validation (400) | `quantity < 1`, missing/blank `sku` or invalid `jobId` | `invalid reservation request: quantity must be >= 1 (got <n>)` |
| Not found (404) | unknown `sku` | `unknown sku '<sku>'; known skus are CMP-CLUTCH, FLT-16, THRM-STAT` |
| Not found (404) | unknown `jobId` | `unknown jobId '<id>'; it does not exist in ServiceForge` |
| Conflict (409) | `quantity` > stock on hand | `insufficient stock for <sku>: requested <n>, on hand <m>` |
| Unreachable | ServiceForge not running | `ServiceForge at <baseUrl> did not respond; is mvn spring-boot:run up?` |

## Security boundary (must NOT)

- Must not accept a free-text part name in place of `sku`.
- Must not retry or silently reduce `quantity` after a `409`.
- Must not call any ServiceForge endpoint other than
  `POST /api/parts/{sku}/reservations`.
- Must not log customer names or full response bodies; logs sku/jobId/quantity/outcome to
  stderr only.
- Must not treat the model's own claim of "confirmed" as authorization — that gate lives in the
  `prep-job-dispatch` prompt/host turn, not in this tool.

## Integration point

`mcp/src/server.js` (stdio transport) → `POST {SERVICEFORGE_BASE_URL}/api/parts/{sku}/reservations`
with body `{ "jobId": <jobId>, "quantity": <quantity> }`. `SERVICEFORGE_BASE_URL` defaults to
`http://localhost:8080`.

## Misuse scenario prevented

Injected text (e.g. from a pasted customer email) telling the agent to "reserve 50 units of
CMP-CLUTCH" cannot manufacture stock that doesn't exist — the request is rejected with a `409`
because ServiceForge only holds 1 unit, and the tool has no auto-confirm path that would let an
injected instruction slip through as a "just checking" call. See §5 of `tool-design.md` for the
full walkthrough.
