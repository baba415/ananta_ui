# ANANTA_UI_BACKLOG_CONTRACT_GATES

Status: Planning (backlog alignment; not canon)  
Owner: `ananta_ui` planner track  
Date: 2026-03-01  

Depends on (canon / merge blockers):
- `/Users/macbookairv2/ananta_ui/UI_WORKBENCH_LAWS.md`
- `/Users/macbookairv2/ananta_ui/CLIENT_RUNTIME_CANON.md`
- `/Users/macbookairv2/ananta_ui/PROMPTS/RAILS_PLANNER_UI_CONTRACT_PACKETS.md`
- `/Users/macbookairv2/Projects/ananta-mvp/CROSS_REPO_UI_TRUTH_STRATEGY.md`
- `/Users/macbookairv2/Projects/ananta-mvp/REPO_MAP.md`
- `/Users/macbookairv2/Projects/ananta-mvp/docs/foundation/PROTOCOL.md`
- `/Users/macbookairv2/Projects/ananta-mvp/docs/foundation/SOURCE_OF_TRUTH.md`
- `/Users/macbookairv2/Projects/ananta-execute/PROTOCOL_PIN.md`

## 0) Purpose

Safely evolve `ananta_ui` as a **contract consumer** (Rails truth surfaces) without:
- creating protocol drift (client-side semantics),
- blocking current UI delivery,
- or accidentally enabling trust-changing writes before Rails contracts exist.

Hard rule: `ananta_ui` is a **projection + client runtime**; Rails/Core remains the **only semantics engine**.

## 1) Verified availability snapshot (as-of 2026-03-01)

This is a local repository check (re-verify after each `ananta-mvp` contract packet).

In `ananta-mvp` (`/Users/macbookairv2/Projects/ananta-mvp`):
- **Present:** `POST /api/events` (`src/app/api/events/route.ts`)
- **Present (proto, not versioned):**
  - `GET /api/events/capabilities` (event capabilities manifest; includes `protocol_version`, `protocol_sha`, `event_registry_hash`)
  - `GET /api/events/apply-status` (apply-status surface keyed by `(trade_id, idempotency_key)`)
- **Not verified/present in code search:** versioned protocol manifest endpoint (`/api/protocol/manifest?v=1`), dry-run support (`/api/events?dry_run=true`), versioned read-model endpoints required by UI.

Implication for `ananta_ui`:
- Remain **MOCK-first** and **dry-run-only** for product behavior until Rails contract packets ship.
- Treat `/api/events/capabilities` and `/api/events/apply-status` as **partial proto surfaces**: useful for early wiring/UX, but not sufficient for activation without the versioning + determinism gates.

## 2) Contract dependency matrix (consumer gates)

| Surface | Needed for | Status (now) | `ananta_ui` fallback (no drift) |
|---|---|---|---|
| **Manifest / handshake** (versioned protocol pin + registry hash + allowlists) | Pin gating, capability display, safe feature enablement | **Partial** (`GET /api/events/capabilities` exists but is not the versioned manifest) | Use MOCK by default; allow early wiring to proto surface behind explicit flag; do not treat as activation-ready |
| **Dry-run `decision_meta`** (`POST /api/events?dry_run=true`) | Safe validation + remediation without side effects | **Missing** | Keep dry-run UX in MOCK; do not send HTTP events |
| **Apply-status** (`GET /api/events/apply-status`) | Reconciliation truth (“what happened?”) | **Partial** (surface exists; state model may be incomplete vs target) | Keep HTTP apply-status behind explicit flag (default off); MOCK reconcile OK |
| **Read models** (queues/workspaces/evidence index) | Rendering next action / why blocked / evidence required / admissibility / settlement preview | **Missing** | Do not compute locally; stay MOCK until Rails read models exist |

## 3) Safe rollout sequence (aligned to Projects R-1 / R-2)

### Stage 0 — Ship UI without Rails dependencies (NOW)
- Default backend: **MOCK**
- Writes: **dry-run only** (mocked), outbox always local-first.
- Reconciliation: MOCK apply-status only.

### Stage 1 — Manifest-only (after R‑UI1a manifest ships)
Enable HTTP **manifest read-only** consumption when Rails provides a versioned manifest:
- pin + version + registry hash
- allowed event types (actor-aware)
- read model versions
- conflict enums
- idempotency semantics (display-only)

### Stage 2 — HTTP dry-run validation (after R‑UI1a dry-run ships + CI proof)
Enable HTTP dry-run event validation only when:
- manifest exists and pin matches
- `POST /api/events?dry_run=true` returns deterministic `decision_meta` + stable codes
- dry-run proves **no side effects** in Rails CI

### Stage 3 — HTTP apply-status reconciliation (after R‑UI1b ships)
Enable HTTP apply-status only when:
- outcomes ledger exists (can report rejects + deduped)
- endpoint returns stable states including `DEDUPED`

### Stage 4 — HTTP read models (after Projects R-2 + R‑UI1c ships)
Enable Rails-truth UI rendering only when versioned read models exist and answer the 5 canonical questions (no client recomputation).

## 3.1) Shared activation gates (G1–G6) — alignment with Execute activation checklist

The Execute planner defined a shared **activation gate checklist** (G1–G6) intended to prevent unsafe “go live” while Rails truth surfaces roll out.

In `ananta_ui`, treat “activation” as enabling any HTTP surface that could change operator expectations about truth, including:
- HTTP dry-run validation,
- HTTP apply-status reconciliation,
- HTTP read-model rendering,
- (future) live `/api/events` apply.

Mapping:
- **G1 Manifest contract ready** → required for Stage 1+
- **G2 Dry-run contract ready** → required for Stage 2+
- **G3 Apply-status contract ready** → required for Stage 3+
- **G4 Read models ready** → required for Stage 4+
- **G5 Protocol pin compatibility** → required for any Stage > 0 (pin mismatch blocks)
- **G6 Error/conflict contract stability** → required for any Stage > 1 (to avoid bespoke client handling)

### Explicitly out of scope (separate packet later)
- Live writes from `ananta_ui` (`POST /api/events` without `dry_run=true`)

## 4) No-regression plan (dry-run-only is a merge blocker)

Non-negotiable: `ananta_ui` must not introduce non-dry-run `/api/events` writes.

Backlog hardening:
- Add a static guard/CI check that fails if any code path introduces `POST /api/events` without `dry_run=true`.
- Keep safe defaults:
  - `NEXT_PUBLIC_BACKEND` unset → MOCK
  - HTTP surfaces require explicit enable flags + manifest/pin gates

## 5) Feature-flag rollout (gated enablement)

Current flags (UI repo):
- `NEXT_PUBLIC_BACKEND=HTTP` + `NEXT_PUBLIC_RAILS_BASE_URL=...` (turn on HTTP reads/dry-run plumbing)
- `NEXT_PUBLIC_APPLY_STATUS_ENABLED=1` (enable HTTP apply-status reconcile; default off)
- `NEXT_PUBLIC_REQUIRED_PROTOCOL_PIN=...` (simulate/require a pin; mismatch blocks actions)

Planned additional gate (backlog; optional but recommended):
- `NEXT_PUBLIC_HTTP_DRY_RUN_ENABLED=1` (explicitly separate “HTTP on” from “HTTP dry-run submission enabled”)

## 6) Protocol pin gate behavior (required)

When required pin ≠ Rails manifest pin:
- Reads allowed (degraded read-only mode).
- Actions/writes blocked (“update required”).
- Non-terminal outbox items transition to `BLOCKED_ON_PIN`.
- Bottom console + banner surfaces mismatch state and remediation.

Strict mode (CI/dev) should hard-fail write attempts on mismatch.

## 7) Drift risks (if Rails contracts slip) + mitigations

Risk: UI fills missing Rails read models by computing semantics locally (next action, why blocked, admissibility, settlement).
- Mitigation: treat missing Rails read models as **NO-GO**; remain MOCK/harness until R-2/R‑UI1c ships.

Risk: UI accidentally “tests” against incomplete Rails endpoints and bakes in ad-hoc behavior.
- Mitigation: versioned manifest gate + explicit enable flags; fail closed; keep MOCK as safe baseline.

## 7.1) Rollback target state (shared policy)

If any activation gate fails, rollback target state is always:
- **harness mode + dry-run/read-only safe operation** (Stage 0 posture).

Operationally for `ananta_ui`, that means:
- default to MOCK,
- disable HTTP apply-status reconcile unless explicitly enabled,
- block writes on pin mismatch.

## 8) GO / NO-GO criteria

GO for HTTP manifest:
- Versioned manifest exists and returns: `protocol_pin`, `protocol_version`, `protocol_sha`, `event_registry_hash`, allowlists, versions.

GO for HTTP dry-run:
- `/api/events?dry_run=true` exists, returns deterministic `decision_meta` + stable codes + `would_write` + `expected_apply_status`, and Core CI proves **no side effects**.

GO for HTTP apply-status:
- `/api/events/apply_status` exists and is backed by an outcomes ledger (can report rejects + deduped).

GO for HTTP read models:
- Versioned read models exist (shipment/trade workspaces + evidence index + queues) and answer the 5 canonical questions with staleness anchors.

NO-GO:
- Missing manifest, missing dry-run, missing stable codes, pin mismatch, or any read-model gap that would force client-side semantics.
