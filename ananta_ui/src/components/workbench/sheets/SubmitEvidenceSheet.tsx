"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type { OutboxTarget } from "@/runtime/outbox";
import { useOutbox } from "@/runtime/outboxStore";
import { useBackend } from "@/rails/backendStore";

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</div>;
}

export function SubmitEvidenceSheet({
  open,
  onClose,
  protocolPin,
  target,
  disabledReason
}: {
  open: boolean;
  onClose(): void;
  protocolPin: string | null;
  target: OutboxTarget;
  disabledReason: string | null;
}) {
  const backend = useBackend();
  const outbox = useOutbox();

  const [evidenceKind, setEvidenceKind] = useState("pod_photo");
  const [note, setNote] = useState("");

  const disabled = useMemo(() => {
    return Boolean(disabledReason) || !protocolPin;
  }, [disabledReason, protocolPin]);

  if (!open) return null;

  function submit() {
    if (disabled || !protocolPin) return;

    const payload = {
      evidence_kind: evidenceKind,
      note: note.trim() ? note.trim() : undefined
    };

    const item = outbox.createItem({
      protocol_pin_at_creation: protocolPin,
      target,
      event_type: "submit_evidence",
      payload
    });

    void outbox.runDryRun(item.local_id, backend, {
      protocol_pin: protocolPin,
      idempotency_key: item.idempotency_key,
      event_type: item.event_type,
      target: item.target,
      payload
    });

    onClose();
  }

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="mt-12 w-full max-w-xl rounded-xl border border-slate-700/60 bg-slate-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800/70 px-4 py-3">
          <div className="text-sm font-semibold text-slate-100">Submit evidence (dry-run)</div>
          <div className="mt-1 text-xs text-slate-400">
            Creates a local outbox entry immediately, then calls <span className="text-slate-200">/api/events?dry_run=true</span>.
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4">
          <div>
            <FieldLabel>Evidence Kind (required)</FieldLabel>
            <select
              className="mt-2 w-full rounded-md border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
              value={evidenceKind}
              onChange={(e) => setEvidenceKind(e.target.value)}
              disabled={disabled}
            >
              <option value="pod_photo">POD photo</option>
              <option value="dropoff_photo">Dropoff photo</option>
              <option value="pickup_signature">Pickup signature</option>
            </select>
          </div>

          <div>
            <FieldLabel>Note (optional)</FieldLabel>
            <input
              className="mt-2 w-full rounded-md border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Add a short note (Operator typed-input budget: optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 p-3 text-xs text-slate-400">
            Target: <span className="text-slate-200">trade {target.trade_id}</span>
            {target.shipment_id ? (
              <>
                {" "}
                • <span className="text-slate-200">shipment {target.shipment_id}</span>
              </>
            ) : null}
          </div>

          {disabledReason ? (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/20 p-3 text-xs text-rose-200">
              {disabledReason}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800/70 px-4 py-3">
          <button
            className="rounded-md border border-slate-700/60 bg-slate-950/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-900/30"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium",
              disabled ? "bg-slate-800 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-500"
            ].join(" ")}
            onClick={submit}
            disabled={disabled}
          >
            Create outbox + dry-run
          </button>
        </div>
      </div>
    </div>
  );
}
