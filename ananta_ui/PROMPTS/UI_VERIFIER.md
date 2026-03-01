# UI Verifier Prompt (ananta_ui)

You are verifying the **Ananta Workbench UI** in `/Users/macbookairv2/ananta_ui`.

Your job is to confirm the implementation matches canon and does not fork protocol semantics.

## Canon (must read)
- `/Users/macbookairv2/ananta_ui/UI_WORKBENCH_LAWS.md`
- `/Users/macbookairv2/ananta_ui/CLIENT_RUNTIME_CANON.md`

## What to run (local environment with npm network access)

```bash
cd /Users/macbookairv2/ananta_ui
npm install
npm run typecheck
npm run dev
```

Open:
- `http://localhost:3000/w/execute-operator`
- `http://localhost:3000/w/execute-supervisor`
- `http://localhost:3000/w/ops-diagnostics`

## Verification checklist (must be explicit PASS/FAIL)

1) **Workbench laws**
   - Left rail selects nodes/queues (navigation only).
   - Center is the only “do surface” (action sheets).
   - Inspector is read-only by default.
   - Bottom console is always visible and is the primary degraded-mode surface.

2) **Operator constraint**
   - Operator mode uses **single active shipment workspace** + quick switcher.
   - No arbitrary tab UI in operator mode.

3) **No client-side semantics**
   - UI does not compute:
     - next required action
     - why blocked
     - admissibility
     - milestone gating
     - settlement decisions
   - It only renders these from read models / decision_meta / apply-status.

4) **Outbox invariants**
   - Every action sheet confirmation creates a local outbox entry immediately (even if offline).
   - Outbox persists across refresh (localStorage is acceptable for v1).

5) **Dry-run-only posture**
   - Confirm HTTP backend only calls `POST /api/events?dry_run=true`.
   - No live writes exist in code paths.

6) **Protocol pin mismatch**
   - Set `NEXT_PUBLIC_REQUIRED_PROTOCOL_PIN` to a mismatching value and verify:
     - reads still work (MOCK mode),
     - writes are blocked,
     - UI surfaces “update required” clearly.

7) **Apply-status reconciliation**
   - In MOCK mode:
     - Create 1–2 outbox items via action sheets
     - Click “Reconcile now”
     - Verify each item shows an `apply:*` pill and details panel includes apply-status fields.
   - In HTTP mode (if Core endpoint exists):
     - Set `NEXT_PUBLIC_APPLY_STATUS_ENABLED=1`
     - Click “Reconcile now” and verify the UI calls `GET /api/events/apply-status` (or underscore fallback) and updates outbox items.

8) **HTTP gating (no accidental activation)**
   - In HTTP mode with `NEXT_PUBLIC_HTTP_DRY_RUN_ENABLED` unset:
     - action sheets still create local outbox entries,
     - UI must not send HTTP dry-run requests,
     - UI must surface “HTTP dry-run disabled” clearly.

## Output format

Return:
- A short PASS/FAIL table.
- Concrete file pointers for any failures (path + line).
- If you find drift risk, propose the smallest fix.

## Required two-part response (because you’ll be sent the same prompt as others)

Reply with:
1) Your own verifier checklist (what you ran/checked).
2) Feedback on this prompt (what’s unclear/missing).
