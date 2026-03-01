# Rails Planner Prompt — UI Contract Packets (Core backlog only)

This prompt is for the **Rails/Core planner** thread. It is a backlog/scope definition. It should **not** derail in-flight AFR work; it should be queued as a follow-on set of small, single-scope PRs.

## Why this exists

We are centralizing product UI + client runtime in `ananta_ui`, but Rails/Core remains the **only semantics engine**. To prevent protocol fork, Core must expose a small set of contract surfaces that all UIs consume.

This is about **reorganizing semantics/contracts**, not reorganizing repos.

## Cross-cutting clarifications (canon)

- R‑UI1a/1b/1c are **Core (Rails) surfaces**. UI repo consumes them.
- “Determinism” means: same normalized input **and same server state snapshot** → same codes/decision_meta.
- `protocol_version` should be returned as:
  - `protocol_version` (human semantic label, e.g. `AFR-1.0`)
  - `protocol_sha` (exact Core commit pin)
  - `manifest_version` (handshake schema version, e.g. `1`)
- Idempotency language:
  - canonical dedup key remains `(trade_id, idempotency_key)`
  - shipment-scoped events **also require** `shipment_id`, but that does not change dedup key fields
  - in the manifest, name this “semantic scope” vs “dedup key fields” to avoid ambiguity

## Sequencing (recommended)

1) **R‑UI1a** (manifest + dry-run + codes) — lowest risk, unlocks UI alignment
2) **R‑UI1b** (apply-status + durable outcomes ledger) — DB-touching, unlocks reconciliation
3) **R‑UI1c** (read models answering 5 canonical questions) — only after codes + apply-status exist

## R‑UI1a — Capabilities/Handshake Manifest + Dry-run Contract + Stable Codes

### Deliverables

1) Versioned manifest endpoint (auth required; actor-aware allowlist):
   - `GET /api/protocol/manifest?v=1` (or `/api/capabilities/v1`)
   - Response includes:
     - `manifest_version: 1`
     - `protocol_pin`
     - `protocol_version` (e.g. `AFR-1.0`)
     - `protocol_sha` (Core commit)
     - `event_registry_hash` (sha256 of canonicalized ordered JSON, not “hash of TS file”)
     - allowed event types for the actor (even if initially same list)
     - read model versions exposed
     - conflict enums (at least `resolution_mode` enum list)
     - idempotency rules (dedup key fields + semantic scope per event type)

2) `/api/events` dry-run support:
   - `POST /api/events?dry_run=true`
   - Must run the **exact same validation** as live apply, but with **no side effects**
   - Response must include deterministic:
     - `decision_meta` (stable `category/code`, `block_code` when relevant, message can evolve)
     - `would_write` semantics:
       - true only if live apply would create a new event row
       - false for reject, no-op accept, or deduped replay
     - `expected_apply_status` with enum including `DEDUPED`

Implementation note: prefer a `validate()` + `apply()` split; dry-run calls `validate()` only. Avoid “write then rollback” patterns that can still trigger outbox/notify side effects.

3) Stable error taxonomy:
   - Stability guarantee applies to: `category`, `code`, `conflict_code`, `resolution_mode`
   - Human-readable `message` may evolve

### Tests (must run in CI)
- Dry-run does not mutate DB state (assert counts unchanged).
- Dry-run determinism for a fixed state snapshot.
- Manifest hash stability: canonicalized JSON hash does not churn on formatting/comments.

## R‑UI1b — Apply-status + Outcomes Ledger (idempotency reconciliation)

### Why it needs DB work
If the client loses the HTTP response and the event was rejected, Core cannot answer apply-status unless it stores outcomes keyed by idempotency key.

### Deliverables
- New durable table (name your choice: `event_attempts` / `idempotency_outcomes`) keyed by `(trade_id, idempotency_key)`:
  - stores last known status: `PENDING|APPLIED|DEDUPED|REJECTED|NEEDS_REVIEW|RETRY_LATER`
  - stores stable `category/code`, remediation hints, timestamps
  - stores `event_id` when accepted/deduped
- `GET /api/events/apply_status?trade_id=...&idempotency_key=...` (auth required)
  - returns canonical reconciliation truth for outbox

### Tests (CI)
- Rejected event produces an apply-status row and can be queried later.
- Deduped replay returns `DEDUPED` deterministically.

## R‑UI1c — Read models answering the 5 canonical UI questions

### Contract rules
- Prefer “one read model per noun” (e.g. `shipment_workspace_view_v1`, `trade_workspace_view_v1`) instead of many micro endpoints.
- Include staleness anchors:
  - `computed_at_utc`
  - `as_of_trade_event_seq` (or equivalent)
- Settlement preview may return a stable NOT_AVAILABLE code until obligations/settlement semantics are fully implemented.

### Must answer (without client recomputation)
1) next required action
2) why blocked (stable `block_code` + `blocking` boolean + message)
3) evidence present + evidence required
4) admissibility state (Draft|Provisional|Final + reasons)
5) settlement preview (RELEASE_OK/HOLD_* + reason codes; or NOT_AVAILABLE until ready)

## Definition of “done”
- Core surfaces exist, are versioned, and are exercised by CI tests.
- `ananta_ui` can run as a dumb projection client (read-only + dry-run + outbox) without duplicating semantics.

