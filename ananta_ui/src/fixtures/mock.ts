import type {
  CapabilitiesManifest,
  DecisionMeta,
  EvidenceIndexView,
  QueueItem,
  ShipmentWorkspaceView,
  TradeWorkspaceView
} from "@/rails/contracts";
import type { ModeId } from "@/rails/mode";

const NOW = "2026-03-01T00:00:00Z";

export const MOCK_CAPABILITIES: CapabilitiesManifest = {
  manifest_version: 1,
  protocol_pin: "ananta-proto@2026-03-01",
  protocol_version: "AFR-1.0",
  protocol_sha: "mock-core-sha-0000000",
  event_registry_hash: "mock-registry-hash-0000000",
  event_versions: {
    submit_evidence: 1,
    complete_milestone: 1
  },
  read_model_versions: {
    shipment_workspace_view: 1,
    trade_workspace_view: 1,
    evidence_index_view: 1,
    queue: 1
  },
  conflict_resolution_modes: [
    "AUTO_ACCEPTED",
    "RETRY_LATER",
    "NEEDS_REVIEW",
    "USER_ACTION_REQUIRED"
  ],
  allowed_event_types: ["submit_evidence", "complete_milestone"],
  idempotency: {
    dedup_key_fields: ["trade_id", "idempotency_key"],
    semantic_scopes: {
      submit_evidence: "shipment",
      complete_milestone: "shipment"
    }
  },
  idempotency_scopes: ["trade", "shipment"]
};

export const MOCK_QUEUES: Record<ModeId, QueueItem[]> = {
  "execute-operator": [
    {
      node: { type: "shipment", id: "shp_1001" },
      title: "SHP-1001 • Ikeja → VI",
      subtitle: "Trade trd_9001",
      badges: ["BLOCKED"],
      updated_at_utc: NOW
    },
    {
      node: { type: "shipment", id: "shp_1002" },
      title: "SHP-1002 • Yaba → Lekki",
      subtitle: "Trade trd_9002",
      badges: ["ACTIVE"],
      updated_at_utc: NOW
    },
    {
      node: { type: "shipment", id: "shp_1003" },
      title: "SHP-1003 • Ajah → Ikorodu",
      subtitle: "Trade trd_9003",
      badges: ["ASSIGNED"],
      updated_at_utc: NOW
    }
  ],
  "execute-supervisor": [
    {
      node: { type: "exception", id: "exc_2001" },
      title: "EXC-2001 • Evidence mismatch",
      subtitle: "Shipment shp_1001",
      badges: ["NEEDS_REVIEW"],
      updated_at_utc: NOW
    },
    {
      node: { type: "exception", id: "exc_2002" },
      title: "EXC-2002 • Settlement hold dispute",
      subtitle: "Trade trd_9002",
      badges: ["BLOCKING"],
      updated_at_utc: NOW
    }
  ],
  "ops-diagnostics": [
    {
      node: { type: "conflict", id: "cfl_3001" },
      title: "CFL-3001 • Idempotency replay",
      subtitle: "Scope: trade trd_9001",
      badges: ["AUTO_ACCEPTED"],
      updated_at_utc: NOW
    },
    {
      node: { type: "outbox", id: "local" },
      title: "Local outbox (device)",
      subtitle: "Runtime truth",
      badges: ["READ_ONLY"],
      updated_at_utc: NOW
    }
  ],
  merchant: [
    {
      node: { type: "trade", id: "trd_9001" },
      title: "TRD-9001 • Lagos retail",
      subtitle: "3 shipments",
      badges: ["ON_HOLD"],
      updated_at_utc: NOW
    },
    {
      node: { type: "trade", id: "trd_9002" },
      title: "TRD-9002 • Lekki wholesale",
      subtitle: "1 shipment",
      badges: ["RELEASING"],
      updated_at_utc: NOW
    }
  ]
};

export const MOCK_SHIPMENT_WORKSPACES: Record<string, ShipmentWorkspaceView> = {
  shp_1001: {
    shipment_id: "shp_1001",
    trade_id: "trd_9001",
    title: "Shipment SHP-1001",
    status_label: "In progress",
    next_action_label: "Submit POD photo",
    why_blocked: {
      block_code: "MISSING_EVIDENCE",
      message: "Proof of delivery (POD) photo required before settlement can release.",
      blocking: true
    },
    settlement_preview: {
      state: "ON_HOLD",
      amount_cents: 125000,
      currency: "NGN",
      message: "On hold until POD evidence is acked by Rails."
    },
    history: [
      { at_utc: "2026-03-01T08:11:00Z", message: "Pickup confirmed", code: "PICKUP_CONFIRMED" },
      { at_utc: "2026-03-01T12:44:00Z", message: "In transit", code: "IN_TRANSIT" }
    ]
  },
  shp_1002: {
    shipment_id: "shp_1002",
    trade_id: "trd_9002",
    title: "Shipment SHP-1002",
    status_label: "Ready",
    next_action_label: "Complete delivery milestone",
    why_blocked: null,
    settlement_preview: {
      state: "RELEASING",
      amount_cents: 86000,
      currency: "NGN",
      message: "Releasing once delivery milestone is applied."
    },
    history: [{ at_utc: "2026-03-01T09:05:00Z", message: "Arrived at destination", code: "ARRIVED" }]
  },
  shp_1003: {
    shipment_id: "shp_1003",
    trade_id: "trd_9003",
    title: "Shipment SHP-1003",
    status_label: "Assigned",
    next_action_label: "Start pickup",
    why_blocked: null,
    settlement_preview: {
      state: "ON_HOLD",
      amount_cents: 54000,
      currency: "NGN",
      message: "On hold until execution begins."
    },
    history: []
  }
};

export const MOCK_TRADE_WORKSPACES: Record<string, TradeWorkspaceView> = {
  trd_9001: {
    trade_id: "trd_9001",
    title: "Trade TRD-9001",
    status_label: "Settlement on hold",
    next_action_label: "Resolve blocking evidence",
    why_blocked: {
      block_code: "SHIPMENT_BLOCKED",
      message: "One or more shipments are blocked on evidence.",
      blocking: true
    },
    settlement_preview: {
      state: "ON_HOLD",
      amount_cents: 125000,
      currency: "NGN",
      message: "Hold reason(s) present; see shipment workspaces."
    },
    history: [{ at_utc: "2026-03-01T07:15:00Z", message: "Trade created", code: "TRADE_CREATED" }]
  },
  trd_9002: {
    trade_id: "trd_9002",
    title: "Trade TRD-9002",
    status_label: "Releasing",
    next_action_label: "Await confirmation",
    why_blocked: null,
    settlement_preview: {
      state: "RELEASING",
      amount_cents: 86000,
      currency: "NGN",
      message: "Settlement releasing."
    },
    history: [{ at_utc: "2026-03-01T10:02:00Z", message: "Settlement scheduled", code: "SETTLEMENT_SCHEDULED" }]
  }
};

export const MOCK_EVIDENCE_INDEX_BY_SHIPMENT_ID: Record<string, EvidenceIndexView> = {
  shp_1001: {
    target: { trade_id: "trd_9001", shipment_id: "shp_1001" },
    items: [
      {
        evidence_id: "evi_5001",
        kind: "pickup_signature",
        status: "ACKED_BY_RAILS",
        captured_at_utc: "2026-03-01T08:12:00Z",
        note: "Receiver signature captured."
      }
    ]
  },
  shp_1002: {
    target: { trade_id: "trd_9002", shipment_id: "shp_1002" },
    items: [
      {
        evidence_id: "evi_5002",
        kind: "dropoff_photo",
        status: "ACKED_BY_RAILS",
        captured_at_utc: "2026-03-01T09:08:00Z"
      }
    ]
  },
  shp_1003: {
    target: { trade_id: "trd_9003", shipment_id: "shp_1003" },
    items: []
  }
};

export const MOCK_DECISION_META_OK: DecisionMeta = {
  ok: true,
  category: "EVENTS",
  code: "DRY_RUN_OK",
  message: "Dry-run OK (no side effects).",
  remediation: [],
  resolution_mode: "AUTO_ACCEPTED",
  blocking: false,
  would_write: true,
  expected_apply_status: { state: "PENDING" }
};

export const MOCK_DECISION_META_BLOCKED: DecisionMeta = {
  ok: false,
  category: "VALIDATION",
  code: "DRY_RUN_BLOCKED",
  block_code: "MISSING_EVIDENCE",
  message: "Dry-run blocked: proof of delivery evidence is required.",
  remediation: [
    {
      code: "ADD_EVIDENCE_POD_PHOTO",
      message: "Attach a POD photo (append-only).",
      action_label: "Submit evidence"
    }
  ],
  resolution_mode: "USER_ACTION_REQUIRED",
  blocking: true,
  would_write: false,
  expected_apply_status: { state: "REJECTED" }
};
