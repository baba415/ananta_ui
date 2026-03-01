"use client";

import type { ReactNode } from "react";

import type { CapabilitiesManifest, EvidenceIndexItem, SettlementPreview, WhyBlocked } from "@/rails/contracts";
import type { ModeId } from "@/rails/mode";
import type { NodeRef } from "@/rails/nodeRef";

import type { WorkspaceBundle } from "../WorkbenchShell";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-800/70 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return <span className="rounded-full border border-slate-700/60 bg-slate-900/40 px-2 py-0.5 text-[11px]">{text}</span>;
}

function EvidenceRow({ item }: { item: EvidenceIndexItem }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-100">{item.kind}</div>
          <div className="mt-0.5 text-xs text-slate-500">{item.evidence_id}</div>
        </div>
        <div className="shrink-0">
          <Pill text={item.status} />
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Captured: <span className="text-slate-200">{new Date(item.captured_at_utc).toLocaleString()}</span>
      </div>
      {item.note ? <div className="mt-1 text-xs text-slate-400">Note: {item.note}</div> : null}
      {item.supersedes_evidence_id ? (
        <div className="mt-1 text-xs text-slate-500">Supersedes: {item.supersedes_evidence_id}</div>
      ) : null}
    </div>
  );
}

function renderWhyBlocked(why: WhyBlocked | null) {
  if (!why) return <div className="text-sm text-slate-400">Not blocked.</div>;
  return (
    <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-amber-100">{why.block_code}</div>
        <Pill text={why.blocking ? "BLOCKING" : "NON_BLOCKING"} />
      </div>
      <div className="mt-2 text-sm text-amber-200/90">{why.message}</div>
    </div>
  );
}

function renderSettlement(preview: SettlementPreview) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-100">{preview.state}</div>
        <div className="text-sm text-slate-200">
          {preview.currency} {(preview.amount_cents / 100).toFixed(2)}
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-400">{preview.message}</div>
    </div>
  );
}

export function Inspector({
  mode,
  node,
  bundle,
  bundleError,
  capabilities
}: {
  mode: ModeId;
  node: NodeRef | null;
  bundle: WorkspaceBundle | null;
  bundleError: string | null;
  capabilities: CapabilitiesManifest | null;
}) {
  const evidence = bundle && (bundle.kind === "shipment" || bundle.kind === "trade") ? bundle.evidence : null;

  const whyBlocked =
    bundle?.kind === "shipment" ? bundle.shipment.why_blocked : bundle?.kind === "trade" ? bundle.trade.why_blocked : null;

  const settlementPreview =
    bundle?.kind === "shipment"
      ? bundle.shipment.settlement_preview
      : bundle?.kind === "trade"
        ? bundle.trade.settlement_preview
        : null;

  const history =
    bundle?.kind === "shipment" ? bundle.shipment.history : bundle?.kind === "trade" ? bundle.trade.history : [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-sm font-semibold text-slate-100">Inspector</div>
          <Pill text={mode.toUpperCase()} />
        </div>
        <div className="mt-1 truncate text-xs text-slate-400">
          {node ? `${node.type}:${node.id}` : "No node selected"}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {capabilities ? `PIN ${capabilities.protocol_pin}` : "PIN unavailable"}
        </div>
      </div>

      {bundleError ? (
        <div className="border-b border-rose-800/60 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
          Workspace error: {bundleError}
        </div>
      ) : null}

      <div className="flex-1 overflow-auto">
        <Section title="Evidence Index">
          {evidence ? (
            <div className="grid gap-2">
              {evidence.items.length === 0 ? (
                <div className="text-sm text-slate-500">No evidence items.</div>
              ) : (
                evidence.items.map((it) => <EvidenceRow key={it.evidence_id} item={it} />)
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Open a shipment/trade node to view evidence.</div>
          )}
        </Section>

        <Section title="Why Blocked">{renderWhyBlocked(whyBlocked)}</Section>

        <Section title="Settlement Preview">
          {settlementPreview ? renderSettlement(settlementPreview) : <div className="text-sm text-slate-500">No preview.</div>}
        </Section>

        <Section title="History / Audit">
          {history && history.length > 0 ? (
            <div className="grid gap-2">
              {history.map((h) => (
                <div key={`${h.at_utc}:${h.code ?? h.message}`} className="rounded-lg border border-slate-800/70 bg-slate-950/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-100">{h.message}</div>
                    {h.code ? <Pill text={h.code} /> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(h.at_utc).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No history.</div>
          )}
        </Section>
      </div>
    </div>
  );
}
