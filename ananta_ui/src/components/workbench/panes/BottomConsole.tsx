"use client";

import { useMemo, useState } from "react";

import type { ApplyStatus, CapabilitiesManifest, DecisionMeta } from "@/rails/contracts";
import type { BackendInfo } from "@/rails/backend";
import { useBackend } from "@/rails/backendStore";
import { useOutbox } from "@/runtime/outboxStore";
import type { OutboxItem } from "@/runtime/outbox";

function Pill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const cls =
    tone === "good"
      ? "border-emerald-800/60 bg-emerald-950/20 text-emerald-100"
      : tone === "warn"
        ? "border-amber-800/60 bg-amber-950/20 text-amber-100"
        : tone === "bad"
          ? "border-rose-800/60 bg-rose-950/20 text-rose-100"
          : "border-slate-700/60 bg-slate-900/40 text-slate-200";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{text}</span>;
}

function toneForStatus(status: OutboxItem["status"]): "neutral" | "good" | "warn" | "bad" {
  switch (status) {
    case "ACCEPTED":
      return "good";
    case "NEEDS_REVIEW":
    case "RETRY_LATER":
      return "warn";
    case "REJECTED":
    case "BLOCKED_ON_PIN":
      return "bad";
    default:
      return "neutral";
  }
}

function DecisionCard({ decision }: { decision: DecisionMeta }) {
  const expected = decision.expected_apply_status;
  const expectedLabel = expected
    ? `${expected.state}${expected.deduped ? " (deduped)" : ""}`
    : null;

  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">{decision.ok ? "Dry-run OK" : "Dry-run blocked"}</div>
          <div className="mt-1 text-sm text-slate-300">{decision.message}</div>
          {decision.block_code ? <div className="mt-1 text-xs text-slate-500">block_code: {decision.block_code}</div> : null}
          {decision.category || decision.code ? (
            <div className="mt-1 text-xs text-slate-500">
              {decision.category ? `category: ${decision.category}` : null}
              {decision.category && decision.code ? " • " : null}
              {decision.code ? `code: ${decision.code}` : null}
            </div>
          ) : null}
          <div className="mt-1 text-xs text-slate-500">would_write: {decision.would_write ? "true" : "false"}</div>
          {expectedLabel ? <div className="mt-1 text-xs text-slate-500">expected_apply_status: {expectedLabel}</div> : null}
        </div>
        <div className="shrink-0 text-right">
          <Pill text={decision.ok ? "OK" : "NOT_OK"} tone={decision.ok ? "good" : "bad"} />
          {decision.resolution_mode ? (
            <div className="mt-2">
              <Pill text={decision.resolution_mode} tone={decision.ok ? "neutral" : "warn"} />
            </div>
          ) : null}
        </div>
      </div>

      {decision.remediation && decision.remediation.length > 0 ? (
        <div className="mt-3 border-t border-slate-800/70 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Remediation</div>
          <div className="mt-2 grid gap-2">
            {decision.remediation.map((r) => (
              <div key={r.code} className="rounded-md border border-slate-800/70 bg-slate-950/30 p-2 text-sm text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{r.code}</div>
                  {r.action_label ? <Pill text={r.action_label} /> : null}
                </div>
                <div className="mt-1 text-sm text-slate-300">{r.message}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function applyStatusTone(apply: ApplyStatus): "neutral" | "good" | "warn" | "bad" {
  switch (apply.state) {
    case "APPLIED":
    case "DEDUPED":
      return "good";
    case "PENDING":
      return "warn";
    case "NEEDS_REVIEW":
    case "RETRY_LATER":
      return "warn";
    case "REJECTED":
      return "bad";
    default:
      return "neutral";
  }
}

function outboxStatusFromApplyStatus(apply: ApplyStatus, prev: OutboxItem["status"]): OutboxItem["status"] {
  switch (apply.state) {
    case "APPLIED":
    case "DEDUPED":
      return "ACCEPTED";
    case "REJECTED":
      return "REJECTED";
    case "NEEDS_REVIEW":
      return "NEEDS_REVIEW";
    case "RETRY_LATER":
      return "RETRY_LATER";
    case "PENDING":
      return "SENDING";
    default:
      return prev;
  }
}

function isApplyStatusEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_APPLY_STATUS_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function BottomConsole({
  online,
  pendingCount,
  backendInfo,
  capabilities,
  pinMismatchMessage
}: {
  online: boolean;
  pendingCount: number;
  backendInfo: BackendInfo;
  capabilities: CapabilitiesManifest | null;
  pinMismatchMessage: string | null;
}) {
  const backend = useBackend();
  const { items, updateItem } = useOutbox();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => items.find((it) => it.local_id === selectedId) ?? null, [items, selectedId]);

  const backendLabel = backendInfo.mode === "HTTP" ? `HTTP ${backendInfo.railsBaseUrl ?? ""}` : "MOCK";
  const conflictCards = useMemo(() => {
    return items
      .filter((it) => it.dry_run_result?.resolution_mode && it.dry_run_result.resolution_mode !== "AUTO_ACCEPTED")
      .slice(0, 5);
  }, [items]);

  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);

  const applyStatusEnabled = useMemo(() => {
    return backendInfo.mode === "MOCK" ? true : isApplyStatusEnabled();
  }, [backendInfo.mode]);
  const reconcileDisabledReason = useMemo(() => {
    if (backendInfo.mode === "HTTP" && !applyStatusEnabled) {
      return "Apply-status reconciliation disabled (set NEXT_PUBLIC_APPLY_STATUS_ENABLED=1).";
    }
    if (backendInfo.mode === "HTTP" && !online) return "Offline (cannot query apply-status).";
    if (items.length === 0) return "No outbox items.";
    return null;
  }, [applyStatusEnabled, backendInfo.mode, online, items.length]);

  async function reconcileNow() {
    if (reconcileDisabledReason) return;
    setReconciling(true);
    setReconcileMessage(null);

    let okCount = 0;
    let errCount = 0;

    for (const it of items) {
      try {
        const applyStatus = await backend.getApplyStatus({
          trade_id: it.target.trade_id,
          idempotency_key: it.idempotency_key
        });
        const nextStatus = outboxStatusFromApplyStatus(applyStatus, it.status);
        updateItem(it.local_id, {
          apply_status: applyStatus,
          status: nextStatus,
          status_before_pin_block: nextStatus === "BLOCKED_ON_PIN" ? it.status_before_pin_block : undefined,
          last_error: undefined
        });
        okCount += 1;
      } catch (err) {
        errCount += 1;
        const message = err instanceof Error ? err.message : "Apply-status query failed";
        updateItem(it.local_id, { last_error: message });
      }
    }

    setReconcileMessage(errCount === 0 ? `Reconciled ${okCount} item(s).` : `Reconciled ${okCount} item(s), ${errCount} error(s).`);
    setReconciling(false);
  }

  return (
    <div className="flex h-full flex-col">
	      <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-2">
	        <div className="min-w-0">
	          <div className="truncate text-sm font-semibold text-slate-100">Console</div>
	          <div className="truncate text-xs text-slate-500">
	            Outbox • apply-status (reconcile) • conflicts (from Rails) • pin/capabilities
	          </div>
	        </div>
	        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Pill text={online ? "ONLINE" : "OFFLINE"} tone={online ? "good" : "warn"} />
          <Pill text={`PENDING ${pendingCount}`} tone={pendingCount > 0 ? "warn" : "neutral"} />
          <Pill text={backendLabel} />
          <Pill text={`DRY_RUN_ONLY`} tone="neutral" />
          {pinMismatchMessage ? <Pill text="PIN_MISMATCH" tone="bad" /> : null}
          <button
            className={[
              "rounded-md border px-2 py-1 text-xs",
              reconcileDisabledReason
                ? "border-slate-800/70 bg-slate-950/10 text-slate-500"
                : "border-slate-700/60 bg-slate-950/10 text-slate-200 hover:bg-slate-900/30"
            ].join(" ")}
            onClick={() => void reconcileNow()}
            disabled={Boolean(reconcileDisabledReason) || reconciling}
            title={reconcileDisabledReason ?? "Query apply-status for outbox items"}
          >
            {reconciling ? "Reconciling…" : "Reconcile now"}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 md:grid-cols-[1fr_420px]">
        {/* Outbox list */}
        <div className="min-w-0 overflow-auto rounded-xl border border-slate-800/70 bg-slate-950/20">
          <div className="flex items-center justify-between border-b border-slate-800/70 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Outbox</div>
            <div className="text-xs text-slate-500">{items.length}</div>
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500">No outbox items yet.</div>
          ) : (
            <div className="grid gap-1 p-2">
              {items.map((it) => (
                <button
                  key={it.local_id}
                  className={[
                    "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left",
                    selectedId === it.local_id
                      ? "border-slate-600/70 bg-slate-900/40"
                      : "border-slate-900/60 bg-slate-950/10 hover:bg-slate-900/30"
                  ].join(" ")}
                  onClick={() => setSelectedId(it.local_id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-100">{it.event_type}</div>
                      <div className="truncate text-xs text-slate-500">
                        trade {it.target.trade_id}
                        {it.target.shipment_id ? ` • shipment ${it.target.shipment_id}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Pill text={it.status} tone={toneForStatus(it.status)} />
                        {it.apply_status ? (
                          <Pill text={`apply:${it.apply_status.state}`} tone={applyStatusTone(it.apply_status)} />
                        ) : null}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{new Date(it.created_at_device_utc).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  {it.last_error ? <div className="text-xs text-rose-200">Error: {it.last_error}</div> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details / capabilities */}
        <div className="min-w-0 overflow-auto rounded-xl border border-slate-800/70 bg-slate-950/20">
          <div className="border-b border-slate-800/70 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Details</div>
          </div>
          <div className="grid gap-3 p-3">
            {reconcileMessage ? (
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 px-3 py-2 text-sm text-slate-300">
                {reconcileMessage}
              </div>
            ) : null}
            {selected ? (
              <>
                <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Outbox item</div>
                  <div className="mt-2 text-sm text-slate-200">{selected.local_id}</div>
                  <div className="mt-1 text-xs text-slate-500">idempotency_key: {selected.idempotency_key}</div>
                  <div className="mt-1 text-xs text-slate-500">protocol_pin_at_creation: {selected.protocol_pin_at_creation}</div>
                  <div className="mt-1 text-xs text-slate-500">attempts: {selected.attempt_count}</div>
                </div>

                {selected.dry_run_result ? <DecisionCard decision={selected.dry_run_result} /> : null}

                {selected.apply_status ? (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Apply-status</div>
                      <Pill text={selected.apply_status.state} tone={applyStatusTone(selected.apply_status)} />
                    </div>
                    {selected.apply_status.message ? (
                      <div className="mt-2 text-sm text-slate-300">{selected.apply_status.message}</div>
                    ) : null}
                    {selected.apply_status.category || selected.apply_status.code ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {selected.apply_status.category ? `category: ${selected.apply_status.category}` : null}
                        {selected.apply_status.category && selected.apply_status.code ? " • " : null}
                        {selected.apply_status.code ? `code: ${selected.apply_status.code}` : null}
                      </div>
                    ) : null}
                    {selected.apply_status.server_event_id ? (
                      <div className="mt-1 text-xs text-slate-500">server_event_id: {selected.apply_status.server_event_id}</div>
                    ) : null}
                    {selected.apply_status.conflict ? (
                      <div className="mt-3 rounded-md border border-amber-800/60 bg-amber-950/20 p-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-amber-100">Conflict</div>
                          <Pill text={selected.apply_status.conflict.resolution_mode} tone="warn" />
                        </div>
                        <div className="mt-1 text-sm text-amber-200/90">{selected.apply_status.conflict.message}</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3 text-sm text-slate-500">
                    No apply-status yet. {applyStatusEnabled ? "Click “Reconcile now”." : "Enable with NEXT_PUBLIC_APPLY_STATUS_ENABLED=1."}
                  </div>
                )}

                {!selected.dry_run_result ? (
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3 text-sm text-slate-400">
                    No dry-run result yet.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3 text-sm text-slate-400">
                Select an outbox item to inspect its dry-run <span className="text-slate-200">decision_meta</span>.
              </div>
            )}

            <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capabilities</div>
              {capabilities ? (
                <div className="mt-2 grid gap-1 text-sm text-slate-300">
                  <div>
                    PIN: <span className="text-slate-100">{capabilities.protocol_pin}</span>
                  </div>
                  {capabilities.manifest_version ? (
                    <div className="text-xs text-slate-500">manifest_version: {capabilities.manifest_version}</div>
                  ) : null}
                  {capabilities.protocol_version ? (
                    <div className="text-xs text-slate-500">protocol_version: {capabilities.protocol_version}</div>
                  ) : null}
                  {capabilities.protocol_sha ? (
                    <div className="text-xs text-slate-500">
                      protocol_sha: <span className="text-slate-200">{capabilities.protocol_sha}</span>
                    </div>
                  ) : null}
                  {capabilities.event_registry_hash ? (
                    <div className="text-xs text-slate-500">
                      event_registry_hash: <span className="text-slate-200">{capabilities.event_registry_hash}</span>
                    </div>
                  ) : null}
                  <div className="text-xs text-slate-500">
                    conflict enums: {capabilities.conflict_resolution_modes.join(", ")}
                  </div>
	                  {capabilities.idempotency?.dedup_key_fields ? (
	                    <div className="text-xs text-slate-500">
	                      idempotency dedup key:{" "}
	                      <span className="text-slate-200">{capabilities.idempotency.dedup_key_fields.join("+")}</span>
	                    </div>
	                  ) : null}
	                  {capabilities.idempotency?.semantic_scopes ? (
	                    <div className="mt-1 text-xs text-slate-500">
	                      idempotency semantic scopes:
	                      <div className="mt-1 grid gap-1">
	                        {Object.entries(capabilities.idempotency.semantic_scopes)
	                          .slice(0, 6)
	                          .map(([eventType, scope]) => (
	                            <div key={eventType} className="flex items-center justify-between gap-2">
	                              <span className="truncate text-slate-200">{eventType}</span>
	                              <span className="shrink-0 text-slate-400">{scope}</span>
	                            </div>
	                          ))}
	                      </div>
	                    </div>
	                  ) : null}
	                  {capabilities.allowed_event_types && capabilities.allowed_event_types.length > 0 ? (
	                    <div className="mt-1 text-xs text-slate-500">
	                      allowed_event_types:{" "}
	                      <span className="text-slate-200">{capabilities.allowed_event_types.join(", ")}</span>
	                    </div>
	                  ) : null}
	                </div>
	              ) : (
	                <div className="mt-2 text-sm text-slate-500">Capabilities manifest not loaded.</div>
	              )}
              {pinMismatchMessage ? (
                <div className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/20 p-3 text-xs text-rose-200">
                  {pinMismatchMessage}
                </div>
              ) : null}
              <div className="mt-3 text-xs text-slate-500">
                Outbox persists in <span className="text-slate-200">localStorage</span> (upgrade path: IndexedDB).
              </div>
            </div>

            <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conflicts / Resolution (Rails-driven)</div>
              {conflictCards.length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">No conflict cards.</div>
              ) : (
                <div className="mt-2 grid gap-2">
                  {conflictCards.map((it) => (
                    <div key={it.local_id} className="rounded-md border border-slate-800/70 bg-slate-950/30 p-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-slate-100">{it.event_type}</div>
                          <div className="truncate text-xs text-slate-500">{it.local_id}</div>
                        </div>
                        {it.dry_run_result?.resolution_mode ? <Pill text={it.dry_run_result.resolution_mode} tone="warn" /> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{it.dry_run_result?.message}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-xs text-slate-500">
                UI does not categorize conflicts locally; it renders Rails <span className="text-slate-200">resolution_mode</span> +
                remediation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
