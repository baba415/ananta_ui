# UI Implementer Prompt (ananta_ui) — Contract-Consumer Hardening Packet

You are implementing the **Ananta Workbench UI** in `/Users/macbookairv2/ananta_ui`.

Goal: ship a single workbench shell (VS Code/Codex mental model) that is **role-shaped** and **protocol-safe**:
- Rails/Core remains the **only semantics engine**.
- UI is a **projection** of Rails read models + dry-run results.
- Client runtime (offline/outbox/retry/capture UX) lives here, but must not compute truth semantics.

## Non-negotiables (merge blockers)

Read and comply with:
- `/Users/macbookairv2/ananta_ui/UI_WORKBENCH_LAWS.md`
- `/Users/macbookairv2/ananta_ui/CLIENT_RUNTIME_CANON.md`

In particular:
- No client-side gating/admissibility/settlement/next-action computation.
- Operator mode: **single active shipment workspace** + quick switcher (no tabs).
- Inspector read-only by default.
- Bottom console always visible; it owns degraded-mode truth (offline/pin/conflicts/outbox).
- Every action creates a local outbox entry immediately.
- Only **dry-run** writes are allowed until Core explicitly enables live writes.

## Context (do not disrupt current UI stream)

This packet is **contract-consumer hardening** only:
- keep MOCK-first safe defaults,
- allow wiring to currently-available Rails proto surfaces without assuming they are activation-ready,
- add explicit feature gates so we cannot accidentally “activate” HTTP behavior.

## Scope (next tranche)

### 1) Capabilities / handshake wiring (proto-safe)

In `ananta-mvp` today, the verified proto surface is:
- `GET /api/events/capabilities` returning `{ ok, capabilities, decision_meta }`

Update `ananta_ui` HTTP backend to:
- Prefer future `GET /api/protocol/manifest?v=1` if present.
- Else consume `GET /api/events/capabilities` (extract `.capabilities` if wrapped).
- Else fall back to legacy paths if present (keep existing fallback).

UI requirements:
- Use `protocol_sha` as the effective “pin” if present (do not invent semantics).
- Console should display: `protocol_version`, `protocol_sha`, `event_registry_hash`, and write/apply-status surface strings if present.

### 2) Apply-status endpoint alignment (proto-safe)

In `ananta-mvp` today, the verified proto surface is:
- `GET /api/events/apply-status?trade_id=...&idempotency_key=...` returning `{ ok, apply_status, ... }` (+ `decision_meta`)

Update `ananta_ui` HTTP backend `getApplyStatus(...)` to:
- Try `/api/events/apply-status` first (hyphen).
- Optionally fall back to `/api/events/apply_status` if needed (underscore).
- Continue to support wrapped `{ apply_status }` responses (already implemented).

### 3) No-regression gates for HTTP dry-run (do not assume Rails dry-run exists)

Right now, Rails dry-run (`POST /api/events?dry_run=true`) is **not verified** as present.

Add an explicit feature gate:
- `NEXT_PUBLIC_HTTP_DRY_RUN_ENABLED=1`

Behavior:
- If backend is HTTP and `NEXT_PUBLIC_HTTP_DRY_RUN_ENABLED` is not enabled:
  - action sheets still create an outbox item immediately,
  - but do **not** send HTTP dry-run,
  - surface a clear “HTTP dry-run disabled” note in the console/outbox item details.

### 4) Dry-run visibility (keep/ensure)

For every dry-run result rendered in the console, ensure we show:
- `ok`, `message`, stable `category/code` when present, `block_code` when present
- `would_write`
- `expected_apply_status` (incl `DEDUPED` when Rails supports it)

### 5) Add a guardrail command (merge blocker)

Add a simple static guard command (script or npm script) that fails if the UI introduces any non-dry-run `/api/events` write surface.
This is to enforce “no live writes” while we’re in Stage 0/Stage 1.

## Prohibited / out of scope
- No live `POST /api/events` without `dry_run=true`.
- No client-side milestone completeness decisions.
- No settlement math in the UI.
- Don’t redesign IA/UX beyond the workbench laws.

## Deliverables
- A single PR on `ananta_ui` implementing the scope above.
- Update `/Users/macbookairv2/ananta_ui/README.md` if endpoint names/env vars change.

## Required two-part response (because you’ll be sent the same prompt as others)

Reply with:
1) Your own implementer plan (what you’ll change + files).
2) Feedback on this prompt (what’s unclear/missing).

## Verification checklist (implementer self-check)
- Operator mode has no tabs; Supervisor/Merchant/Ops may use tabs.
- Bottom console remains visible and shows outbox + dry-run decision_meta.
- Pin mismatch blocks actions (and is clearly visible).
- App still runs in MOCK mode without any Rails server.
