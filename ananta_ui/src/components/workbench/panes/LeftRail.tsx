"use client";

import { useMemo, useState } from "react";

import type { CapabilitiesManifest, QueueItem } from "@/rails/contracts";
import { MODE_IDS, MODE_META, type ModeId, type ModeMeta } from "@/rails/mode";
import type { NodeRef } from "@/rails/nodeRef";
import { nodeKey } from "@/rails/nodeRef";

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-slate-700/60 bg-slate-900/40 px-2 py-0.5 text-[11px] text-slate-200">
      {text}
    </span>
  );
}

function CommandPalette({
  open,
  onClose,
  items,
  onOpenNode
}: {
  open: boolean;
  onClose(): void;
  items: QueueItem[];
  onOpenNode(node: NodeRef): void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((it) => `${it.title} ${it.subtitle ?? ""} ${it.node.id}`.toLowerCase().includes(query));
  }, [items, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 p-3" onClick={onClose}>
      <div
        className="mx-auto mt-16 w-full max-w-lg rounded-xl border border-slate-700/60 bg-slate-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800/70 p-3">
          <input
            className="w-full rounded-md border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Search queue…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="mt-2 text-xs text-slate-400">Enter to open, Esc to close (basic)</div>
        </div>
        <div className="max-h-[55vh] overflow-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-slate-400">No matches.</div>
          ) : (
            filtered.map((it) => (
              <button
                key={nodeKey(it.node)}
                className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-slate-900/40"
                onClick={() => {
                  onOpenNode(it.node);
                  onClose();
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm text-slate-100">{it.title}</div>
                  <div className="shrink-0 text-xs text-slate-500">{it.node.id}</div>
                </div>
                {it.subtitle ? <div className="truncate text-xs text-slate-400">{it.subtitle}</div> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function LeftRail({
  mode,
  modeMeta,
  queue,
  queueError,
  capabilities,
  capError,
  pinMismatchMessage,
  online,
  pendingCount,
  onModeChange,
  onOpenNode
}: {
  mode: ModeId;
  modeMeta: ModeMeta;
  queue: QueueItem[];
  queueError: string | null;
  capabilities: CapabilitiesManifest | null;
  capError: string | null;
  pinMismatchMessage: string | null;
  online: boolean;
  pendingCount: number;
  onModeChange(mode: ModeId): void;
  onOpenNode(node: NodeRef): void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const queueCount = queue.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-tight">Ananta Workbench</div>
          <div className="flex items-center gap-2">
            <Badge text={online ? "ONLINE" : "OFFLINE"} />
            <Badge text={`PENDING ${pendingCount}`} />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <div className="truncate">{modeMeta.label}</div>
          <div className="truncate">
            {capabilities ? `PIN ${capabilities.protocol_pin}` : capError ? "PIN unavailable" : "Loading pin…"}
          </div>
        </div>
        {pinMismatchMessage ? (
          <div className="mt-2 rounded-lg border border-rose-800/60 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
            {pinMismatchMessage}
          </div>
        ) : null}
      </div>

      <div className="px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</div>
        <div className="mt-2 grid gap-2">
          {MODE_IDS.map((id) => {
            const meta = MODE_META[id];
            const active = id === mode;
            return (
              <button
                key={id}
                className={[
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                  active
                    ? "border-slate-500/70 bg-slate-900/60 text-slate-100"
                    : "border-slate-800/70 bg-slate-950/10 text-slate-300 hover:bg-slate-900/30"
                ].join(" ")}
                onClick={() => onModeChange(id)}
              >
                <span>{meta.shortLabel}</span>
                <span className="text-xs text-slate-500">{meta.readOnly ? "read-only" : "dry-run"}</span>
              </button>
            );
          })}
        </div>

        <button
          className="mt-3 w-full rounded-lg border border-slate-800/70 bg-slate-950/10 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-900/30"
          onClick={() => setPaletteOpen(true)}
        >
          Search / Command palette
          <div className="text-xs text-slate-500">Quick-open by id/title (mock)</div>
        </button>
      </div>

      <div className="flex-1 overflow-hidden border-t border-slate-800/70">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Queue</div>
          <div className="text-xs text-slate-500">{queueCount}</div>
        </div>
        {queueError ? (
          <div className="px-4 py-2 text-sm text-rose-200">Queue error: {queueError}</div>
        ) : null}
        <div className="h-full overflow-auto px-2 pb-4">
          {queue.map((it) => (
            <button
              key={nodeKey(it.node)}
              className="mt-1 flex w-full flex-col gap-1 rounded-lg border border-slate-900/60 bg-slate-950/10 px-3 py-2 text-left hover:bg-slate-900/30"
              onClick={() => onOpenNode(it.node)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 truncate text-sm text-slate-100">{it.title}</div>
                <div className="shrink-0 text-xs text-slate-500">{it.node.id}</div>
              </div>
              {it.subtitle ? <div className="truncate text-xs text-slate-400">{it.subtitle}</div> : null}
              {it.badges && it.badges.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {it.badges.slice(0, 3).map((b) => (
                    <Badge key={b} text={b} />
                  ))}
                </div>
              ) : null}
            </button>
          ))}
          {queue.length === 0 && !queueError ? (
            <div className="px-3 py-4 text-sm text-slate-500">Empty queue.</div>
          ) : null}
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={queue} onOpenNode={onOpenNode} />
    </div>
  );
}
