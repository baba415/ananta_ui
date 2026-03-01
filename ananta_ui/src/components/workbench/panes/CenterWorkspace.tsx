"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CapabilitiesManifest, QueueItem } from "@/rails/contracts";
import type { ModeId, ModeMeta } from "@/rails/mode";
import type { NodeRef } from "@/rails/nodeRef";
import { nodeKey } from "@/rails/nodeRef";

import type { WorkspaceBundle } from "../WorkbenchShell";
import { CompleteMilestoneSheet } from "../sheets/CompleteMilestoneSheet";
import { SubmitEvidenceSheet } from "../sheets/SubmitEvidenceSheet";

function formatMoney(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function tabStorageKey(mode: ModeId): string {
  return `ananta.tabs.${mode}.v1`;
}

function loadTabs(mode: ModeId): NodeRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(tabStorageKey(mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as NodeRef[];
  } catch {
    return [];
  }
}

function persistTabs(mode: ModeId, tabs: NodeRef[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tabStorageKey(mode), JSON.stringify(tabs));
  } catch {
    // ignore
  }
}

function Tab({
  active,
  title,
  subtitle,
  onClick,
  onClose
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  onClick(): void;
  onClose(): void;
}) {
  return (
    <div
      className={[
        "group flex items-center gap-2 rounded-t-lg border-x border-t px-3 py-2 text-sm",
        active
          ? "border-slate-700/70 bg-slate-950/60 text-slate-100"
          : "border-slate-900/60 bg-slate-950/20 text-slate-300 hover:bg-slate-900/30"
      ].join(" ")}
    >
      <button className="min-w-0 flex-1 truncate text-left" onClick={onClick}>
        <div className="truncate">{title}</div>
        {subtitle ? <div className="truncate text-[11px] text-slate-500">{subtitle}</div> : null}
      </button>
      <button
        className="rounded-md px-1.5 py-1 text-xs text-slate-500 opacity-0 hover:bg-slate-900/40 hover:text-slate-200 group-hover:opacity-100"
        onClick={onClose}
        aria-label="Close tab"
      >
        ✕
      </button>
    </div>
  );
}

export function CenterWorkspace({
  mode,
  modeMeta,
  node,
  queue,
  bundle,
  bundleError,
  capabilities,
  pinMismatchMessage,
  online,
  mountedAt,
  onOpenNode
}: {
  mode: ModeId;
  modeMeta: ModeMeta;
  node: NodeRef | null;
  queue: QueueItem[];
  bundle: WorkspaceBundle | null;
  bundleError: string | null;
  capabilities: CapabilitiesManifest | null;
  pinMismatchMessage: string | null;
  online: boolean;
  mountedAt: number;
  onOpenNode(node: NodeRef): void;
}) {
  const router = useRouter();
  const [tabs, setTabs] = useState<NodeRef[]>(() => loadTabs(mode));

  useEffect(() => {
    setTabs(loadTabs(mode));
  }, [mode]);

  useEffect(() => {
    persistTabs(mode, tabs);
  }, [mode, tabs]);

  useEffect(() => {
    if (!modeMeta.allowTabs || !node) return;
    setTabs((prev) => {
      const k = nodeKey(node);
      if (prev.some((t) => nodeKey(t) === k)) return prev;
      return [node, ...prev].slice(0, 8);
    });
  }, [modeMeta.allowTabs, node?.type, node?.id]);

  const queueIndexByKey = useMemo(() => {
    const map = new Map<string, QueueItem>();
    for (const it of queue) map.set(nodeKey(it.node), it);
    return map;
  }, [queue]);

  const shipmentQueue = useMemo(() => queue.filter((q) => q.node.type === "shipment"), [queue]);
  const activeShipmentId = node?.type === "shipment" ? node.id : "";

  const [sheet, setSheet] = useState<null | "submit_evidence" | "complete_milestone">(null);

  const actionDisabledReason = useMemo(() => {
    if (modeMeta.readOnly) return "This mode is read-only (writes are disabled).";
    if (!capabilities) return "Capabilities manifest not loaded yet.";
    if (pinMismatchMessage) return pinMismatchMessage;
    if (!node) return "Open a node to run an action.";
    if (node.type !== "shipment") return "Actions are only wired for shipment nodes in Day-1.";
    if (!bundle || bundle.kind !== "shipment") return "Shipment workspace not loaded yet.";
    return null;
  }, [modeMeta.readOnly, capabilities, pinMismatchMessage, node, bundle]);

  const shipmentTarget = useMemo(() => {
    if (!bundle || bundle.kind !== "shipment") return null;
    return { trade_id: bundle.shipment.trade_id, shipment_id: bundle.shipment.shipment_id };
  }, [bundle]);

  const protocolPin = capabilities?.protocol_pin ?? null;

  const headerTitle = useMemo(() => {
    if (!node) return "Select a node";
    if (bundle?.kind === "shipment") return bundle.shipment.title;
    if (bundle?.kind === "trade") return bundle.trade.title;
    return `${node.type.toUpperCase()} ${node.id}`;
  }, [node, bundle]);

  return (
    <div className="relative flex h-full min-w-0 flex-col">
      {/* Tabs (Supervisor/Merchant/Ops) */}
      {modeMeta.allowTabs && tabs.length > 0 ? (
        <div className="flex min-w-0 items-stretch gap-1 overflow-x-auto border-b border-slate-800/70 bg-slate-950/20 px-3 pt-3">
          {tabs.map((t) => {
            const qi = queueIndexByKey.get(nodeKey(t));
            return (
              <Tab
                key={nodeKey(t)}
                active={node ? nodeKey(t) === nodeKey(node) : false}
                title={qi?.title ?? `${t.type} ${t.id}`}
                subtitle={qi?.subtitle}
                onClick={() => onOpenNode(t)}
                onClose={() => {
                  setTabs((prev) => prev.filter((x) => nodeKey(x) !== nodeKey(t)));
                  if (node && nodeKey(node) === nodeKey(t)) {
                    const remaining = tabs.filter((x) => nodeKey(x) !== nodeKey(t));
                    if (remaining.length > 0) onOpenNode(remaining[0]);
                    else router.push(`/w/${mode}`);
                  }
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="border-b border-slate-800/70 bg-slate-950/20 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{modeMeta.label}</div>
          <div className="mt-1 truncate text-base font-semibold text-slate-100">{headerTitle}</div>
        </div>
      )}

      {/* Operator quick switcher */}
      {!modeMeta.allowTabs ? (
        <div className="border-b border-slate-800/70 bg-slate-950/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active shipment</div>
              <div className="text-xs text-slate-500">Single workspace + quick switcher (no tabs)</div>
            </div>
            <select
              className="w-[260px] max-w-[55vw] rounded-md border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100"
              value={activeShipmentId}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                onOpenNode({ type: "shipment", id });
              }}
            >
              <option value="" disabled>
                Select shipment…
              </option>
              {shipmentQueue.map((q) => (
                <option key={q.node.id} value={q.node.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto p-4">
        {bundleError ? (
          <div className="mb-4 rounded-lg border border-rose-800/60 bg-rose-950/20 p-3 text-sm text-rose-200">
            Workspace error: {bundleError}
          </div>
        ) : null}

        {node === null ? (
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-6">
            <div className="text-lg font-semibold text-slate-100">Open a node from the queue.</div>
            <div className="mt-2 text-sm text-slate-400">
              Left rail selects <span className="text-slate-200">what</span> you’re working on. Center is the only{" "}
              <span className="text-slate-200">do surface</span>.
            </div>
          </div>
        ) : bundle?.kind === "shipment" ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-slate-100">{bundle.shipment.title}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Status: <span className="text-slate-200">{bundle.shipment.status_label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action (Rails)</div>
                  <div className="mt-1 text-sm text-slate-100">{bundle.shipment.next_action_label}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Primary actions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    actionDisabledReason ? "bg-slate-800 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-500"
                  ].join(" ")}
                  disabled={Boolean(actionDisabledReason)}
                  onClick={() => setSheet("submit_evidence")}
                >
                  Submit evidence
                </button>
                <button
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    actionDisabledReason ? "bg-slate-800 text-slate-500" : "bg-slate-900/60 text-slate-100 hover:bg-slate-900"
                  ].join(" ")}
                  disabled={Boolean(actionDisabledReason)}
                  onClick={() => setSheet("complete_milestone")}
                >
                  Complete milestone
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Any action creates a local outbox item immediately (Law 6). Live writes are not implemented in this packet.
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Settlement preview (Rails)</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-slate-700/60 bg-slate-900/40 px-2 py-0.5 text-xs">
                  {bundle.shipment.settlement_preview.state}
                </span>
                <span className="text-slate-200">
                  {formatMoney(bundle.shipment.settlement_preview.amount_cents, bundle.shipment.settlement_preview.currency)}
                </span>
                <span className="text-slate-400">{bundle.shipment.settlement_preview.message}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Runtime</div>
              <div className="mt-2 text-sm text-slate-300">
                Connectivity: <span className="text-slate-100">{online ? "online" : "offline"}</span>
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Session started: <span className="text-slate-100">{new Date(mountedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ) : bundle?.kind === "trade" ? (
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-6">
            <div className="text-lg font-semibold text-slate-100">{bundle.trade.title}</div>
            <div className="mt-2 text-sm text-slate-400">
              Status: <span className="text-slate-200">{bundle.trade.status_label}</span>
            </div>
            <div className="mt-2 text-sm text-slate-400">
              Next action (Rails): <span className="text-slate-200">{bundle.trade.next_action_label}</span>
            </div>
            <div className="mt-3 text-xs text-slate-500">Actions are Day-1 wired for shipment nodes only.</div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-6">
            <div className="text-lg font-semibold text-slate-100">
              {node.type.toUpperCase()} {node.id}
            </div>
            <div className="mt-2 text-sm text-slate-400">No read model wired for this node type yet (Day-1 scaffold).</div>
          </div>
        )}
      </div>

      {sheet === "submit_evidence" && shipmentTarget ? (
        <SubmitEvidenceSheet
          open
          onClose={() => setSheet(null)}
          protocolPin={protocolPin}
          target={shipmentTarget}
          disabledReason={actionDisabledReason}
        />
      ) : null}

      {sheet === "complete_milestone" && shipmentTarget ? (
        <CompleteMilestoneSheet
          open
          onClose={() => setSheet(null)}
          protocolPin={protocolPin}
          target={shipmentTarget}
          disabledReason={actionDisabledReason}
        />
      ) : null}
    </div>
  );
}
