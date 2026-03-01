import type { ApplyStatus, DecisionMeta } from "@/rails/contracts";

export type OutboxItemStatus =
  | "PENDING_LOCAL"
  | "SENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "NEEDS_REVIEW"
  | "RETRY_LATER"
  | "BLOCKED_ON_PIN";

export type OutboxTarget = {
  trade_id: string;
  shipment_id?: string;
};

export type OutboxItem = {
  local_id: string;
  created_at_device_utc: string;
  actor_user_id?: string;
  acting_org_id?: string;
  protocol_pin_at_creation: string;
  target: OutboxTarget;
  event_type: string;
  idempotency_key: string;
  payload: unknown;
  dry_run_result?: DecisionMeta;
  apply_status?: ApplyStatus;
  status: OutboxItemStatus;
  status_before_pin_block?: OutboxItemStatus;
  attempt_count: number;
  next_retry_at_utc?: string;
  last_error?: string;
};

export function isOutboxTerminal(status: OutboxItemStatus): boolean {
  return status === "ACCEPTED" || status === "REJECTED" || status === "NEEDS_REVIEW";
}
