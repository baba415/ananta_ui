import type { NodeRef } from "@/rails/nodeRef";

export type ProtocolPin = string;

export type ConflictResolutionMode =
  | "AUTO_ACCEPTED"
  | "RETRY_LATER"
  | "NEEDS_REVIEW"
  | "USER_ACTION_REQUIRED";

export type CapabilitiesManifest = {
  // Handshake/versioning (Core-owned; optional until Core ships the manifest).
  manifest_version?: number;
  protocol_pin: ProtocolPin;
  protocol_version?: string; // human label (e.g. "AFR-1.0")
  protocol_sha?: string; // exact Core commit pin
  event_registry_hash?: string; // hash of canonicalized registry representation

  event_versions: Record<string, number>;
  read_model_versions: Record<string, number>;
  conflict_resolution_modes: ConflictResolutionMode[];

  // Actor-aware allowlists (optional).
  allowed_event_types?: string[];

  // Idempotency semantics (optional; UI displays only; Core enforces).
  idempotency?: {
    dedup_key_fields: string[]; // e.g. ["trade_id", "idempotency_key"]
    semantic_scopes: Record<string, "trade" | "shipment">; // per event_type
  };

  // Back-compat shim (pre-manifest prototypes).
  idempotency_scopes?: Array<"trade" | "shipment">;
};

export type QueueItem = {
  node: NodeRef;
  title: string;
  subtitle?: string;
  badges?: string[];
  updated_at_utc: string;
};

export type EvidenceIndexItemStatus =
  | "ACKED_BY_RAILS"
  | "REJECTED_BY_RAILS"
  | "SUPERSEDED";

export type EvidenceIndexItem = {
  evidence_id: string;
  kind: string;
  status: EvidenceIndexItemStatus;
  captured_at_utc: string;
  note?: string;
  supersedes_evidence_id?: string;
};

export type EvidenceIndexView = {
  target: {
    trade_id: string;
    shipment_id?: string;
  };
  items: EvidenceIndexItem[];
};

export type SettlementPreview = {
  state: "ON_HOLD" | "RELEASING" | "RELEASED";
  amount_cents: number;
  currency: string;
  message: string;
};

export type WhyBlocked = {
  block_code: string;
  message: string;
  blocking: boolean;
};

export type HistoryEvent = {
  at_utc: string;
  message: string;
  code?: string;
};

export type ShipmentWorkspaceView = {
  shipment_id: string;
  trade_id: string;
  title: string;
  status_label: string;
  next_action_label: string;
  why_blocked: WhyBlocked | null;
  settlement_preview: SettlementPreview;
  history: HistoryEvent[];
};

export type TradeWorkspaceView = {
  trade_id: string;
  title: string;
  status_label: string;
  next_action_label: string;
  why_blocked: WhyBlocked | null;
  settlement_preview: SettlementPreview;
  history: HistoryEvent[];
};

export type RemediationItem = {
  code: string;
  message: string;
  action_label?: string;
};

export type ApplyStatusState =
  | "UNKNOWN"
  | "PENDING"
  | "APPLIED"
  | "DEDUPED"
  | "REJECTED"
  | "NEEDS_REVIEW"
  | "RETRY_LATER";

export type ApplyStatus = {
  state: ApplyStatusState;
  at_utc?: string;
  server_event_id?: string;

  // Back-compat: legacy representation for dedupe (prefer `state=DEDUPED`).
  deduped?: boolean;

  // Stable taxonomy (optional; Core-owned).
  category?: string;
  code?: string;
  message?: string;

  conflict?: {
    conflict_code?: string;
    resolution_mode: ConflictResolutionMode;
    blocking: boolean;
    message: string;
    remediation?: RemediationItem[];
  };
};

export type DecisionMeta = {
  ok: boolean;
  category?: string;
  code?: string;
  block_code?: string;
  message: string;
  remediation: RemediationItem[];
  resolution_mode?: ConflictResolutionMode;
  blocking?: boolean;
  would_write: boolean;
  expected_apply_status?: ApplyStatus;
};
