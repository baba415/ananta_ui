# UI_WORKBENCH_LAWS (Ananta UI)

Status: Canon (merge-blocker for UI drift)  
Owner: `ananta_ui` (product surfaces + client runtime)  
Depends on: Rails/Core contracts (protocol pin, capabilities manifest, read models, `/api/events`, apply-status)

## 0) Purpose

This document canonizes the **Workbench UI laws** so the product can scale across roles and exceptions **without becoming an ERP form app** and without forking protocol semantics.

If UI behavior conflicts with these laws, UI must change.

---

## 1) Non-negotiable laws

### Law 1 — UI is a projection

- UI must render truth from Rails read models.
- UI must not compute truth semantics (gating, admissibility, settlement outcome, next-required-action, “why blocked”).
- UI may compute *display-only convenience* (sorting/grouping) but never protocol decisions.

### Law 2 — One shell, role-shaped interaction

There is one workbench shell, but interaction primitives differ by mode:
- **Operator mode:** single active shipment workspace + quick switcher (no arbitrary tab explosion).
- **Supervisor/Merchant/Ops:** tabs/workspaces are allowed.

### Law 3 — Actions live in the center

- The center workspace is the only “do surface.”
- If a user can change trust state, it must occur via an **Action Sheet** in the center (or a mode-specific action panel), producing an outbox entry.

### Law 4 — Inspector is truth (read-only by default)

- The right inspector is for *inspection* (evidence index, history, status, “why blocked”, settlement preview).
- Inspector is read-only by default. Any edits must route back through an Action Sheet.

### Law 5 — System output is always visible when it matters

- The bottom console owns: outbox status, apply-status reconciliation, conflicts, retries, pin mismatch, and deterministic error codes.
- Offline/pending state must be visible at all times (badge + last sync + pending count).

### Law 6 — Every tap produces a local event immediately

- On any user intent (capture/confirm/submit), UI writes a local outbox item immediately.
- Upload/network is secondary. “I tapped” must be durable locally.

### Law 7 — Evidence is append-only; mistakes are superseded

- Evidence cannot be edited or deleted in place.
- Corrections happen via **supersession** (new evidence references old; old remains visible in history).
- “Accepted/verified/rejected/superseded” is server-acknowledged state surfaced via Rails read models.

### Law 8 — Typed-input budget is sacred (Operator)

- Operator happy path: **max 1 required typed field per milestone**.
- If a flow requires more typing, it’s a spec smell and must be redesigned (capture + pickers + defaults + supervisor intervention).

---

## 2) Workbench layout (desktop/tablet)

### Left rail — Mode + navigation + queues

Must contain:
- Mode switcher (Execute Operator / Execute Supervisor / Ops Diagnostics / Merchant)
- Search / command palette entry
- Queue lists relevant to the active mode (with counts/badges)

Rules:
- Left rail selects *what* you’re working on (node selection), not *how* you do it.

### Center workspace — Action-first surface

Must contain:
- The selected node workspace (shipment/trade/exception/etc.)
- Primary CTAs and action sheets
- Progress + next step guidance (from Rails read models)

Rules:
- Center must not become a scrolling form.
- Center must always be able to answer: “What do I do next?” (from Rails) and “Do it now.”

### Right inspector — Truth, provenance, and “why”

Must contain (tabs or sections):
- Evidence index (with ack states)
- History / audit trail (read-only)
- “Why blocked” (block_code + message)
- Settlement preview (hold/release + reasons)
- Protocol pin + capability context (at least in Ops mode, optionally everywhere)

Rules:
- Inspector may *explain* and *link*, but not *decide*.

### Bottom console — Outbox + apply-status + conflicts

Must contain:
- Outbox list (pending/sending/accepted/rejected/needs_review/retry_later/pin_blocked)
- Apply-status reconciliation results
- Conflict cards using Rails `resolution_mode` + remediation
- Error stream using stable taxonomy/codes

Rules:
- If the system is degraded (offline, pin mismatch, conflicts), the console is the first-class surface.

---

## 3) Mobile/PWA choreography (same mental model, different shape)

- Left rail → full-screen “Queues/Modes” screen (or bottom tabs)
- Center workspace → default screen
- Right inspector → slide-over drawer
- Bottom console → status pill + expandable drawer

Operator constraint tightens on mobile:
- single active shipment workspace
- quick switcher for “active shipment” selection
- minimize mode switching during active execution

---

## 4) Modes and allowed UI behavior

### Execute (Operator)

Primary: capture + confirm milestone actions.
- Single active shipment workspace
- Quick switcher for assigned/recent shipments
- Action sheets only; no freeform admin edits

### Execute (Supervisor)

Primary: resolve exceptions + adjudications.
- Tabs allowed
- Decision cards must require explicit reason when Rails requires it
- Must surface consequence preview and remediation steps (from Rails where possible)

### Ops Diagnostics (read-only by default)

Primary: debugging, reconciliation, truth inspection.
- Protocol pin display
- Capabilities manifest viewer
- Apply-status explorer (idempotency reconciliation)
- Event trace read surfaces (if Rails exposes them)

### Merchant (stub → later)

Primary: trade/shipment overview + settlement preview.
- Read-only until Rails surfaces are complete
- Tabs allowed

---

## 5) Node model (navigation primitive)

Definition: a **Node** is an addressable object the user can open and operate on.

Node requirements:
- Node has stable identity: `{type, id}` (Rails nouns: trade/shipment/exception/evidence/outbox/conflict)
- Node is deep-linkable
- Node can be opened via:
  - queue click
  - search/command palette
  - deep link

Rules:
- UI does not create new “truth nouns” casually.
- If UI introduces a convenience noun (e.g., “Trip”), it must map cleanly to Rails nouns and never replace them in contracts.

---

## 6) Action Sheet rules (write intent boundary in UI)

All trust-changing actions must:
- create a local outbox item immediately
- run dry-run validation first (when enabled/available)
- only perform live writes when dry-run indicates safe/allowed (policy-defined)
- show deterministic server `decision_meta` and remediation on failure
- reconcile final status via apply-status + read model refresh

Action sheets must not:
- attempt to “fix” blocked states by guessing missing semantics
- hide or swallow server codes/messages

---

## 7) Degraded-mode laws (offline, pin mismatch, conflict)

### Offline

- UI must remain usable for capture and staging.
- “Pending upload / pending server ack” must be explicit everywhere relevant.

### Protocol pin mismatch

- UI must degrade safely:
  - read-only allowed
  - writes blocked
  - banner + console card “update required”
- Strict mode (CI/dev) hard-fails write attempts.

### Conflicts

- UI must not categorize conflicts itself.
- UI behavior must follow Rails `resolution_mode` and remediation fields.

---

## 8) Prohibited patterns (ERP creep killers)

UI must not:
- add “just one more field” in inspector
- require multi-step data entry to complete happy-path milestones
- compute readiness/admissibility/settlement client-side from raw events
- hide blockers behind generic “something went wrong”
- treat media upload success as truth acceptance (server ack required)

---

## 9) Acceptance checks (UI repo)

A change is non-conformant if:
- Operator mode introduces arbitrary tabs/workspaces
- Any screen computes next action / blocked reasons locally
- Any write bypasses Action Sheets + outbox
- Offline state can be invisible while actions are pending
- Evidence can be edited/deleted rather than superseded

Minimum CI checks (UI repo):
- read-only mode renders queue + shipment workspace + inspector + console
- dry-run returns deterministic decision_meta and creates no server side effects
- pin mismatch blocks writes and degrades to read-only
- conflict cards render from `resolution_mode` without local business rules
