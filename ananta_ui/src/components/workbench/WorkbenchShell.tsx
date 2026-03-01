"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  CapabilitiesManifest,
  EvidenceIndexView,
  QueueItem,
  ShipmentWorkspaceView,
  TradeWorkspaceView
} from "@/rails/contracts";
import { MODE_META, type ModeId } from "@/rails/mode";
import type { NodeRef } from "@/rails/nodeRef";
import { nodeHref } from "@/rails/nodeRef";
import { useBackend } from "@/rails/backendStore";
import { useOutbox } from "@/runtime/outboxStore";
import { isOutboxTerminal } from "@/runtime/outbox";
import { useOnlineStatus } from "@/runtime/useOnlineStatus";

import { BottomConsole } from "./panes/BottomConsole";
import { CenterWorkspace } from "./panes/CenterWorkspace";
import { Inspector } from "./panes/Inspector";
import { LeftRail } from "./panes/LeftRail";

export type WorkspaceBundle =
  | {
      kind: "shipment";
      shipment: ShipmentWorkspaceView;
      evidence: EvidenceIndexView;
    }
  | {
      kind: "trade";
      trade: TradeWorkspaceView;
      evidence: EvidenceIndexView;
    }
  | { kind: "unsupported"; node: NodeRef };

export function WorkbenchShell({
  mode,
  node,
  mountedAt
}: {
  mode: ModeId;
  node: NodeRef | null;
  mountedAt: number;
}) {
  const router = useRouter();
  const backend = useBackend();
  const outbox = useOutbox();
  const online = useOnlineStatus();

  const modeMeta = MODE_META[mode];

  const [capabilities, setCapabilities] = useState<CapabilitiesManifest | null>(null);
  const [capError, setCapError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const pendingCount = useMemo(() => {
    return outbox.items.filter((it) =>
      it.status === "PENDING_LOCAL" ||
      it.status === "SENDING" ||
      it.status === "RETRY_LATER" ||
      it.status === "BLOCKED_ON_PIN"
    ).length;
  }, [outbox.items]);

  const requiredPin = process.env.NEXT_PUBLIC_REQUIRED_PROTOCOL_PIN ?? null;
  const pinMismatchMessage =
    requiredPin && capabilities && capabilities.protocol_pin !== requiredPin
      ? `Protocol pin mismatch — required ${requiredPin}, got ${capabilities.protocol_pin}. Writes blocked.`
      : null;

  useEffect(() => {
    if (!capabilities) return;

    if (pinMismatchMessage) {
      for (const it of outbox.items) {
        if (isOutboxTerminal(it.status)) continue;
        if (it.status === "BLOCKED_ON_PIN") continue;

        outbox.updateItem(it.local_id, {
          status_before_pin_block: it.status,
          status: "BLOCKED_ON_PIN"
        });
      }
      return;
    }

    // Pin mismatch resolved: unblock previously blocked items.
    for (const it of outbox.items) {
      if (it.status !== "BLOCKED_ON_PIN") continue;
      outbox.updateItem(it.local_id, {
        status: it.status_before_pin_block ?? "PENDING_LOCAL",
        status_before_pin_block: undefined
      });
    }
  }, [capabilities, pinMismatchMessage, outbox]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCapError(null);
      try {
        const cap = await backend.getCapabilitiesManifest();
        if (cancelled) return;
        setCapabilities(cap);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load capabilities manifest";
        setCapError(msg);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setQueueError(null);
      try {
        const items = await backend.getQueue(mode);
        if (cancelled) return;
        setQueue(items);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load queue";
        setQueueError(msg);
        setQueue([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backend, mode]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBundleError(null);
      setBundle(null);

      if (!node) return;

      try {
        if (node.type === "shipment") {
          const shipment = await backend.getShipmentWorkspaceView(node.id);
          const evidence = await backend.getEvidenceIndexView({
            trade_id: shipment.trade_id,
            shipment_id: shipment.shipment_id
          });
          if (cancelled) return;
          setBundle({ kind: "shipment", shipment, evidence });
          return;
        }

        if (node.type === "trade") {
          const trade = await backend.getTradeWorkspaceView(node.id);
          const evidence = await backend.getEvidenceIndexView({
            trade_id: trade.trade_id
          });
          if (cancelled) return;
          setBundle({ kind: "trade", trade, evidence });
          return;
        }

        setBundle({ kind: "unsupported", node });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load workspace";
        setBundleError(msg);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [backend, node?.type, node?.id]);

  function openNode(next: NodeRef) {
    router.push(nodeHref(mode, next));
  }

  function switchMode(nextMode: ModeId) {
    if (nextMode === mode) return;
    if (node) {
      router.push(nodeHref(nextMode, node));
      return;
    }
    router.push(`/w/${nextMode}`);
  }

  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-950/40 px-3 py-2 md:hidden">
        <button
          className="rounded-md border border-slate-700/60 bg-slate-900/50 px-3 py-1.5 text-sm"
          onClick={() => setMobileLeftOpen(true)}
        >
          Queues
        </button>
        <div className="text-sm font-medium">{modeMeta.shortLabel}</div>
        <button
          className="rounded-md border border-slate-700/60 bg-slate-900/50 px-3 py-1.5 text-sm"
          onClick={() => setMobileInspectorOpen(true)}
        >
          Inspector
        </button>
      </div>

      <div className="grid h-[calc(100vh-41px)] grid-rows-[1fr_240px] md:h-screen md:grid-cols-[280px_1fr_360px] md:grid-rows-[1fr_240px]">
        <div className="hidden border-r border-slate-800/70 bg-slate-950/25 md:block">
          <LeftRail
            mode={mode}
            modeMeta={modeMeta}
            queue={queue}
            queueError={queueError}
            capabilities={capabilities}
            capError={capError}
            pinMismatchMessage={pinMismatchMessage}
            online={online}
            pendingCount={pendingCount}
            onModeChange={switchMode}
            onOpenNode={openNode}
          />
        </div>

        <div className="min-w-0 bg-slate-950/10">
          <CenterWorkspace
            mode={mode}
            modeMeta={modeMeta}
            node={node}
            queue={queue}
            bundle={bundle}
            bundleError={bundleError}
            capabilities={capabilities}
            pinMismatchMessage={pinMismatchMessage}
            online={online}
            mountedAt={mountedAt}
            onOpenNode={openNode}
          />
        </div>

        <div className="hidden border-l border-slate-800/70 bg-slate-950/25 md:block">
          <Inspector mode={mode} node={node} bundle={bundle} bundleError={bundleError} capabilities={capabilities} />
        </div>

        <div className="col-span-1 border-t border-slate-800/70 bg-slate-950/40 md:col-span-3">
          <BottomConsole
            online={online}
            pendingCount={pendingCount}
            backendInfo={backend.info}
            capabilities={capabilities}
            pinMismatchMessage={pinMismatchMessage}
          />
        </div>
      </div>

      {/* Mobile drawers */}
      {mobileLeftOpen ? (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileLeftOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-[86vw] max-w-sm bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <LeftRail
              mode={mode}
              modeMeta={modeMeta}
              queue={queue}
              queueError={queueError}
              capabilities={capabilities}
              capError={capError}
              pinMismatchMessage={pinMismatchMessage}
              online={online}
              pendingCount={pendingCount}
              onModeChange={(m) => {
                setMobileLeftOpen(false);
                switchMode(m);
              }}
              onOpenNode={(n) => {
                setMobileLeftOpen(false);
                openNode(n);
              }}
            />
          </div>
        </div>
      ) : null}

      {mobileInspectorOpen ? (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileInspectorOpen(false)}>
          <div className="absolute inset-y-0 right-0 w-[86vw] max-w-sm bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <Inspector mode={mode} node={node} bundle={bundle} bundleError={bundleError} capabilities={capabilities} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
