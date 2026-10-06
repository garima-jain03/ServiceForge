Prep Job Dispatch — host-side prompt template

Purpose
- Provide a deterministic host-side sequence to prepare and confirm part reservations for a scheduled job. This template enforces the security boundary: read-only checks can run automatically, but any write (reserve_part_for_job) requires an explicit human confirmation token.

Sequence (must be enforced by host code invoking the MCP tools)
1. Resolve the exact SKU: do not accept free-text part names. If the dispatcher provided a name, ask them to select the SKU from the catalog. (You may call `get_part_stock` to help make a selection.)
2. Optionally call `get_part_stock` with `sku` to retrieve `quantityOnHand` and show it to the dispatcher.
3. Present dispatcher with the proposed action and require an exact confirmation phrase before calling the write tool. The confirmation phrase format must be: `CONFIRM RESERVE job:<jobId> sku:<sku> qty:<quantity>` (case-insensitive but exact tokens). The host must reject any other phrasing.
4. If confirmation phrase received, host calls `reserve_part_for_job` with the exact inputs. Surface any `isError: true` result to the dispatcher and do NOT retry automatically on 409/400/404.
5. On success (201), inform dispatcher and record the fact via postTurnHook (already wired in reserve tool).

Why this matters
- This sequence prevents accidental write-side effects from injected free-text (customer emails, chat transcripts). It makes the human explicitly responsible for committing stock.

Error handling
- If `get_part_stock` returns `unknown sku` → ask dispatcher to re-run selection.
- If `reserve_part_for_job` returns 409 (insufficient stock) → present the exact server text and ask dispatcher whether to abort or modify quantity (explicit additional confirmation required to retry).
