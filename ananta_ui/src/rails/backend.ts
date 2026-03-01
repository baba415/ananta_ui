import type {
  ApplyStatus,
  CapabilitiesManifest,
  DecisionMeta,
  EvidenceIndexView,
  QueueItem,
  ShipmentWorkspaceView,
  TradeWorkspaceView
} from "@/rails/contracts";
import type { ModeId } from "@/rails/mode";

import {
  MOCK_CAPABILITIES,
  MOCK_DECISION_META_BLOCKED,
  MOCK_DECISION_META_OK,
  MOCK_EVIDENCE_INDEX_BY_SHIPMENT_ID,
  MOCK_QUEUES,
  MOCK_SHIPMENT_WORKSPACES,
  MOCK_TRADE_WORKSPACES
} from "@/fixtures/mock";

export type BackendMode = "MOCK" | "HTTP";

export type EventCandidate = {
  protocol_pin: string;
  idempotency_key: string;
  event_type: string;
  target: {
    trade_id: string;
    shipment_id?: string;
  };
  payload: unknown;
};

export type BackendInfo = {
  mode: BackendMode;
  railsBaseUrl?: string;
};

export interface Backend {
  info: BackendInfo;
  getCapabilitiesManifest(): Promise<CapabilitiesManifest>;
  getQueue(mode: ModeId): Promise<QueueItem[]>;
  getShipmentWorkspaceView(shipmentId: string): Promise<ShipmentWorkspaceView>;
  getTradeWorkspaceView(tradeId: string): Promise<TradeWorkspaceView>;
  getEvidenceIndexView(target: {
    trade_id: string;
    shipment_id?: string;
  }): Promise<EvidenceIndexView>;
  dryRunEvent(candidate: EventCandidate): Promise<DecisionMeta>;
  getApplyStatus(input: { trade_id: string; idempotency_key: string }): Promise<ApplyStatus>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackendModeFromEnv(): BackendMode {
  const raw = process.env.NEXT_PUBLIC_BACKEND;
  if (!raw) return "MOCK";
  if (raw === "HTTP") return "HTTP";
  return "MOCK";
}

function getRailsBaseUrlFromEnv(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_RAILS_BASE_URL;
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}${text ? ` — ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

function createMockBackend(): Backend {
  function stubApplyStatus(input: { trade_id: string; idempotency_key: string }): ApplyStatus {
    const key = `${input.trade_id}:${input.idempotency_key}`;
    const last = key[key.length - 1]?.toUpperCase() ?? "0";
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const idx = Math.max(0, alphabet.indexOf(last));
    const bucket = idx % 6;
    switch (bucket) {
      case 0:
        return { state: "PENDING", category: "APPLY_STATUS", code: "PENDING" };
      case 1:
        return { state: "APPLIED", category: "APPLY_STATUS", code: "APPLIED" };
      case 2:
        return { state: "DEDUPED", deduped: true, category: "APPLY_STATUS", code: "DEDUPED" };
      case 3:
        return { state: "REJECTED", category: "APPLY_STATUS", code: "REJECTED", message: "Stub rejection (mock)" };
      case 4:
        return { state: "NEEDS_REVIEW", category: "APPLY_STATUS", code: "NEEDS_REVIEW", message: "Stub needs-review (mock)" };
      default:
        return { state: "RETRY_LATER", category: "APPLY_STATUS", code: "RETRY_LATER", message: "Stub retry-later (mock)" };
    }
  }

  return {
    info: { mode: "MOCK" },
    async getCapabilitiesManifest() {
      await sleep(120);
      return MOCK_CAPABILITIES;
    },
    async getQueue(mode) {
      await sleep(120);
      return MOCK_QUEUES[mode] ?? [];
    },
    async getShipmentWorkspaceView(shipmentId) {
      await sleep(120);
      const view = MOCK_SHIPMENT_WORKSPACES[shipmentId];
      if (!view) throw new Error(`No mock ShipmentWorkspaceView for ${shipmentId}`);
      return view;
    },
    async getTradeWorkspaceView(tradeId) {
      await sleep(120);
      const view = MOCK_TRADE_WORKSPACES[tradeId];
      if (!view) throw new Error(`No mock TradeWorkspaceView for ${tradeId}`);
      return view;
    },
    async getEvidenceIndexView(target) {
      await sleep(120);
      if (!target.shipment_id) {
        return {
          target: { trade_id: target.trade_id },
          items: []
        };
      }
      return (
        MOCK_EVIDENCE_INDEX_BY_SHIPMENT_ID[target.shipment_id] ?? {
          target: { trade_id: target.trade_id, shipment_id: target.shipment_id },
          items: []
        }
      );
    },
    async dryRunEvent(candidate) {
      await sleep(250);
      if (candidate.event_type === "submit_evidence") return MOCK_DECISION_META_OK;
      if (candidate.event_type === "complete_milestone") return MOCK_DECISION_META_BLOCKED;
      return {
        ok: false,
        block_code: "UNKNOWN_EVENT_TYPE",
        message: `No mock decision_meta for event_type=${candidate.event_type}`,
        remediation: [],
        resolution_mode: "USER_ACTION_REQUIRED",
        blocking: true,
        would_write: false,
        expected_apply_status: { state: "REJECTED" }
      };
    },
    async getApplyStatus(input) {
      await sleep(150);
      return stubApplyStatus(input);
    }
  };
}

function createHttpBackend(railsBaseUrl: string): Backend {
  function normalizeDecisionMetaResponse(raw: unknown): DecisionMeta {
    const root = raw as any;
    const base =
      raw && typeof raw === "object" && "decision_meta" in (raw as any) && typeof (raw as any).decision_meta === "object"
        ? (raw as any).decision_meta
        : raw;

    if (!base || typeof base !== "object") {
      return {
        ok: false,
        message: "Invalid decision_meta response",
        remediation: [],
        would_write: false,
        expected_apply_status: { state: "UNKNOWN" }
      };
    }

    const wouldWrite =
      typeof root?.would_write === "boolean"
        ? root.would_write
        : typeof (base as any).would_write === "boolean"
          ? (base as any).would_write
          : false;

    const expectedApplyStatus =
      (root && typeof root === "object" && "expected_apply_status" in root ? (root as any).expected_apply_status : undefined) ??
      (base as any).expected_apply_status;

    return {
      ...(base as any),
      ok: Boolean((base as any).ok),
      message: typeof (base as any).message === "string" ? (base as any).message : "",
      remediation: Array.isArray((base as any).remediation) ? (base as any).remediation : [],
      would_write: wouldWrite,
      expected_apply_status: expectedApplyStatus
    } as DecisionMeta;
  }

  function normalizeApplyStatusResponse(raw: unknown): ApplyStatus {
    const base =
      raw && typeof raw === "object" && "apply_status" in raw && typeof (raw as any).apply_status === "object"
        ? (raw as any).apply_status
        : raw;
    if (!base || typeof base !== "object") return { state: "UNKNOWN" };

    const stateRaw = (base as any).state;
    const state = typeof stateRaw === "string" ? stateRaw : "UNKNOWN";
    if (state === "UNKNOWN") return { state: "UNKNOWN" };

    if (state === "APPLIED" && (base as any).deduped === true) {
      return { ...(base as any), state: "DEDUPED", deduped: true } as ApplyStatus;
    }

    return base as ApplyStatus;
  }

  return {
    info: { mode: "HTTP", railsBaseUrl },
    async getCapabilitiesManifest() {
      try {
        return await fetchJson<CapabilitiesManifest>(`${railsBaseUrl}/api/protocol/manifest?v=1`);
      } catch {
        return await fetchJson<CapabilitiesManifest>(`${railsBaseUrl}/api/capabilities`);
      }
    },
    async getQueue(mode) {
      return fetchJson<QueueItem[]>(`${railsBaseUrl}/api/ui/queue?mode=${encodeURIComponent(mode)}`);
    },
    async getShipmentWorkspaceView(shipmentId) {
      return fetchJson<ShipmentWorkspaceView>(
        `${railsBaseUrl}/api/ui/shipment_workspace?shipment_id=${encodeURIComponent(shipmentId)}`
      );
    },
    async getTradeWorkspaceView(tradeId) {
      return fetchJson<TradeWorkspaceView>(
        `${railsBaseUrl}/api/ui/trade_workspace?trade_id=${encodeURIComponent(tradeId)}`
      );
    },
    async getEvidenceIndexView(target) {
      const params = new URLSearchParams({ trade_id: target.trade_id });
      if (target.shipment_id) params.set("shipment_id", target.shipment_id);
      return fetchJson<EvidenceIndexView>(`${railsBaseUrl}/api/ui/evidence_index?${params.toString()}`);
    },
    async dryRunEvent(candidate) {
      const raw = await fetchJson<unknown>(`${railsBaseUrl}/api/events?dry_run=true`, {
        method: "POST",
        body: JSON.stringify(candidate)
      });
      return normalizeDecisionMetaResponse(raw);
    },
    async getApplyStatus(input) {
      const params = new URLSearchParams({
        trade_id: input.trade_id,
        idempotency_key: input.idempotency_key
      });
      const raw = await fetchJson<unknown>(`${railsBaseUrl}/api/events/apply_status?${params.toString()}`);
      return normalizeApplyStatusResponse(raw);
    }
  };
}

export function getBackend(): Backend {
  const mode = getBackendModeFromEnv();
  if (mode === "HTTP") {
    const railsBaseUrl = getRailsBaseUrlFromEnv();
    if (railsBaseUrl) return createHttpBackend(railsBaseUrl);
    return createMockBackend();
  }

  return createMockBackend();
}
