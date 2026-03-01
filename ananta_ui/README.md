# Ananta Workbench UI (ananta_ui)

Redesigned “workbench” shell UI (VS Code/Codex mental model) implementing **read-only** rendering + **dry-run** action staging.

Canon docs (merge blockers):
- `UI_WORKBENCH_LAWS.md`
- `CLIENT_RUNTIME_CANON.md`

## Run

Prereqs: Node.js 20+

```bash
npm install
npm run dev
```

Open `http://localhost:3000/w/execute-operator`.

## Backend switch

Default is **MOCK** (fixtures live in `src/fixtures/mock.ts`).

To use **HTTP** (Rails):

```bash
NEXT_PUBLIC_BACKEND=HTTP
NEXT_PUBLIC_RAILS_BASE_URL=http://localhost:3000
```

Expected HTTP endpoints (Day-1 assumptions):
- `GET /api/protocol/manifest?v=1` → capabilities/handshake manifest (preferred)
- `GET /api/capabilities` → legacy alias (fallback until Core ships manifest)
- `GET /api/ui/queue?mode=...` → queue list
- `GET /api/ui/shipment_workspace?shipment_id=...`
- `GET /api/ui/trade_workspace?trade_id=...`
- `GET /api/ui/evidence_index?trade_id=...&shipment_id=...`
- `POST /api/events?dry_run=true` → returns `decision_meta` (no side effects; includes `would_write` + `expected_apply_status` such as `DEDUPED`)
- `GET /api/events/apply_status?trade_id=...&idempotency_key=...` → apply-status reconciliation (optional; see feature flag below)

## Protocol pin mismatch (optional)

To simulate a pin mismatch that **blocks writes**:

```bash
NEXT_PUBLIC_REQUIRED_PROTOCOL_PIN=ananta-proto@SOME_OTHER_PIN
```

## Outbox + dry-run (no live writes)

- Any action sheet confirmation immediately creates a local outbox item (localStorage).
- The client then submits a **dry-run** request and stores the returned `decision_meta` on the outbox item.
- Live `/api/events` writes (without `dry_run=true`) are intentionally **not implemented** in this packet.

Local storage:
- Outbox key: `ananta.outbox.v1`
- Upgrade path: IndexedDB (for larger payloads + attachments)

Apply-status reconcile (optional; feature-flagged for HTTP backend):

```bash
NEXT_PUBLIC_APPLY_STATUS_ENABLED=1
```

## Routing / deep links

Nodes are addressed as `{type, id}` (Rails nouns) and are deep-linkable:

`/w/:mode/:type/:id`

Example:
- `/w/execute-operator/shipment/shp_1001`

## Sanity checks

After installing dependencies:

```bash
npm run typecheck
```
