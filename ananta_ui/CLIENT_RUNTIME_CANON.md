# CLIENT_RUNTIME_CANON (UI repo)

Status: Canon for UI repo (merge-blocker)  
Owner: UI repo (`ananta_ui`)  
Depends on: Rails/Core contract surfaces (protocol pin, capabilities manifest, read models, `/api/events`, apply-status)

## 0) Purpose

Define the **client runtime** rules for Ananta’s single UI repo:
- offline outbox,
- capture + media upload lifecycle,
- retry/backoff + reconciliation,
- apply-status driven truth about “what happened”.

UI repo must not become a semantics engine. Truth semantics are Rails-owned.

## 1) Non-goals

- Re-implementing gating/admissibility/settlement/next-action logic in the client.
- Building a second ledger of truth.
- Defining event schemas locally (client consumes Rails registry/artifacts).

## 2) Invariants (must hold)

1) Every user action produces a **local outbox entry immediately** (even offline).  
2) Trust-changing effects occur only when Rails accepts `/api/events`.  
3) Client never infers acceptance from “upload succeeded”; it uses apply-status/read models.  
4) Client is deterministic: same inputs + same Rails contracts → same user-visible state transitions.  
5) Evidence is append-only; corrections are supersessions (no delete/edit of historical artifacts).  

## 3) Rails dependencies (contract surfaces)

UI runtime depends on Rails providing:
- capabilities manifest (pin + allowed events + versions + conflict enums + idempotency rules)
- read models answering:
  - next required action
  - why blocked (block_code)
  - evidence present/required
  - admissibility state
  - settlement preview
- `/api/events` supporting:
  - dry-run (`dry_run=true`) returning deterministic `decision_meta`
  - live apply returning `decision_meta` + initial apply_status
- apply-status endpoint (canonical reconciliation truth)

UI must refuse to “invent” these answers.

## 4) Runtime states (canonical)

### 4.1 Outbox item status

- `PENDING_LOCAL` (created locally, not sent)
- `SENDING`
- `ACCEPTED` (Rails accepted; may be deduped)
- `REJECTED` (Rails rejected; remediation required)
- `NEEDS_REVIEW` (Rails accepted as “needs review” / conflict requiring supervision)
- `RETRY_LATER` (transient failure or prescribed retry)
- `BLOCKED_ON_PIN` (protocol pin mismatch / update required)

UI must render these states in the bottom console and per-node inspector.

### 4.2 Media attachment status (two-phase ack)

- `CAPTURED_LOCAL`
- `UPLOAD_PENDING`
- `UPLOADING`
- `UPLOADED_UNACKED`
- `ACKED_BY_RAILS` (evidence index shows it)
- `REJECTED_BY_RAILS`
- `SUPERSEDED`

`ACKED_BY_RAILS` is only true when Rails read models/evidence index reflect it.

## 5) Local outbox data model (minimum)

Outbox item fields (conceptual; storage backend is implementation-specific):
- `local_id` (ULID)
- `created_at_device_utc`
- `actor_user_id` (if known)
- `acting_org_id` (if required by Rails)
- `protocol_pin_at_creation` (from capabilities manifest)
- `target`:
  - `trade_id` (always present for trust events)
  - optional `shipment_id` (when shipment-scoped)
- `event_type`
- `idempotency_key` (must be deterministic per user intent)
- `payload` (JSON)
- `dry_run_result` (last decision_meta)
- `apply_status` (last known from Rails)
- `status` (from 4.1)
- `attempt_count`, `next_retry_at_utc`, `last_error`

Media attachment fields (if any):
- `attachments[]` with local references and upload status.

## 6) Send pipeline (read-only → dry-run → live)

### 6.1 Read-only mode

- UI only calls Rails read models + capabilities manifest.
- UI may create local drafts but does not send events.

### 6.2 Dry-run submit

- Client sends the exact event candidate to Rails with `dry_run=true`.
- Rails returns deterministic `decision_meta` + `would_write` + `expected_apply_status`.
- Client stores `dry_run_result`.
- If `decision_meta.ok=false`, client blocks live write and shows remediation.
- Dry-run must be repeatable without side effects.

### 6.3 Live write

- Client sends the same payload + idempotency key to `/api/events` (no mutation from dry-run).
- Client records the response `decision_meta` + initial apply_status snapshot.
- Client transitions outbox item based on `apply_status` and `resolution_mode` if conflict.

## 7) Reconciliation loop (apply-status driven)

On network availability and on an interval:
- For each non-terminal outbox item, query apply-status using the canonical key.
- Update local status based on server response.
- Refresh the relevant Rails read model to update “next action”, “why blocked”, evidence index, admissibility, settlement preview.

UI must never mark an item ACCEPTED without server confirmation.

## 8) Conflict handling (UX is driven by Rails)

UI behavior is driven by Rails conflict response:
- `resolution_mode=AUTO_ACCEPTED`: mark ACCEPTED, show info
- `resolution_mode=RETRY_LATER`: schedule retry
- `resolution_mode=NEEDS_REVIEW`: escalate to supervisor queue
- `resolution_mode=USER_ACTION_REQUIRED`: show required remediation and block progression if `blocking=true`

Client must not implement bespoke conflict categories.

## 9) Protocol pin mismatch policy

- Strict mode (CI/dev toggle): hard stop; no writes.
- Production: degrade safely:
  - read-only allowed,
  - writes blocked with “update required” banner,
  - existing outbox items marked `BLOCKED_ON_PIN` until resolved.

## 10) Operator-mode UX constraint (avoid tab chaos)

- Operator mode uses a **single active shipment workspace** plus a quick switcher.
- Supervisor/Merchant modes may use tabs/workspaces.
- Workbench shell is shared, but interaction primitives are mode-specific.

## 11) Required docs in UI repo (merge blockers)

- `CLIENT_RUNTIME_CANON.md` (this file)
- `UI_WORKBENCH_LAWS.md` (shell + pane laws + “inspector read-only by default”)
- `CONFLICT_UX_PLAYBOOK.md` (optional; mapping driven by Rails `resolution_mode`, not local business rules)

## 12) Acceptance tests (runtime)

Minimum:
- offline capture creates local outbox + local log entry immediately
- dry-run returns deterministic decision_meta; no side effects
- live write idempotency replay produces no duplicate effects
- apply-status reconciliation updates UI statuses correctly
- evidence is never treated as accepted until Rails ack appears in read model
- pin mismatch blocks writes and degrades to read-only

