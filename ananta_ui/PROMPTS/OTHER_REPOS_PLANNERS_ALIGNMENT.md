# Cross‑Repo Planner Alignment Prompt (send to planners only)

Planning-only request. Do **not** implement or change code in this response.

We are aligning four repos to prevent protocol drift:
- Rails/Core: `/Users/macbookairv2/Projects/ananta-mvp`
- Execute (canonical tracked): `/Users/macbookairv2/Projects/ananta-execute` (ignore `/Users/macbookairv2/excute_card` for shipping)
- Merchant/Ops harness: `/Users/macbookairv2/doc_generator/ananta_delivery_pilot`
- Product UI + client runtime: `/Users/macbookairv2/ananta_ui`

Canon / merge blockers:
- `/Users/macbookairv2/Projects/ananta-mvp/docs/foundation/PROTOCOL.md`
- `/Users/macbookairv2/Projects/ananta-mvp/docs/foundation/SOURCE_OF_TRUTH.md`
- `/Users/macbookairv2/Projects/ananta-mvp/CROSS_REPO_UI_TRUTH_STRATEGY.md`
- `/Users/macbookairv2/Projects/ananta-mvp/REPO_MAP.md`
- `/Users/macbookairv2/Projects/ananta-execute/PROTOCOL_PIN.md`
- UI repo canon: `/Users/macbookairv2/ananta_ui/UI_WORKBENCH_LAWS.md`, `/Users/macbookairv2/ananta_ui/CLIENT_RUNTIME_CANON.md`

Goal:
Safely include contract-consumer evolution in backlog and plan activation gates (no drift; no blocking current delivery).

Hard constraints:
1) Planning-only response (no implementation).
2) Preserve current in-flight work in your repo.
3) UI/clients must remain **projection + outbox runtime** (no local truth semantics).
4) Activation is gated by shared checklist G1–G6 (manifest, dry-run, apply-status, read models, pin compatibility, stable codes).

## What I need from you (planner output)

### A) Status snapshot (Gate table)
Return a table for **G1–G6** with `PASS | PARTIAL | FAIL`, plus 1–2 evidence pointers (file path/tests/commands) per gate:
- **G1** Manifest/handshake ready (pin/version/hash + capabilities metadata).
- **G2** Dry-run contract ready (deterministic decision meta + would_write + no side effects).
- **G3** Apply-status ready (durable outcomes for `(trade_id,idempotency_key)`; accepted/rejected/dedup/conflict).
- **G4** Read models ready (versioned queue/workspace/evidence index; avoids client truth recomputation).
- **G5** Protocol pin compatibility (pinned SHA matches canonical; mismatch blocks activation).
- **G6** Stable error/conflict contract (machine-readable codes, enums, tests).

### B) Contract dependency matrix (for your repo)
For each surface: `available | partial | missing` + **fallback behavior** that avoids drift:
- manifest/handshake
- dry-run decision_meta
- apply-status
- read models

### C) Backlog insertion plan (do not derail in-flight work)
List backlog items in **small packets** with sequencing. Each packet should name:
- scope (1 PR),
- acceptance criteria,
- verifier gates.

### D) Activation/rollback plan
Describe:
- which feature flags exist/will exist (default OFF),
- canary strategy (if applicable),
- rollback target state (harness + read-only/dry-run safe mode).

### E) Drift risks if Rails contracts slip
Name top 3 drift risks and mitigations.

### F) GO/NO-GO criteria
Condition-based criteria (not dates) for enabling the next activation stage.

## Required “two-part” response
Because the same prompt is being sent to multiple planners, reply with:
1) **Your planner output** (A–F above).
2) **Feedback on this prompt** (what’s unclear/missing; what would make it easier for your repo).

## Repo-specific notes (answer if relevant)

### If you are the Rails/Core planner (`ananta-mvp`)
Current verified proto surfaces include:
- `POST /api/events`
- `GET /api/events/capabilities`
- `GET /api/events/apply-status`
Dry-run (`/api/events?dry_run=true`) and versioned read models are not verified yet.

Please include in your backlog plan:
- whether `/api/events/capabilities` becomes the versioned manifest or is wrapped by `/api/protocol/manifest?v=1`,
- dry-run validators (validate/apply split) + CI proof “no side effects”,
- read models answering the 5 canonical questions (next action, why blocked, evidence present/required, admissibility, settlement preview),
- protocol pin policy on mismatch (strict CI, safe degrade prod).

### If you are the Execute planner (`ananta-execute`)
Activation is currently blocked by protocol pin mismatch (see `scripts/check_protocol_pin.py` + `PROTOCOL_PIN.md`).
Plan EX-1A/EX-1B work should proceed with flags default OFF; EX-1C requires G1–G6 PASS.

### If you are the Merchant/Ops harness planner (`doc_generator/ananta_delivery_pilot`)
DG-1A is spec-lock posture; DG-1B shadow mode defaults safe. Keep `rails_write_enabled=false` until R-1 gates pass.

