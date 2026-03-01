"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { DecisionMeta } from "@/rails/contracts";
import type { Backend, EventCandidate } from "@/rails/backend";
import type { OutboxItem, OutboxItemStatus, OutboxTarget } from "@/runtime/outbox";
import { ulid } from "@/runtime/ulid";

type OutboxContextValue = {
  items: OutboxItem[];
  createItem(input: {
    protocol_pin_at_creation: string;
    target: OutboxTarget;
    event_type: string;
    payload: unknown;
  }): OutboxItem;
  updateItem(localId: string, patch: Partial<OutboxItem>): void;
  runDryRun(localId: string, backend: Backend, candidateOverride?: EventCandidate): Promise<void>;
};

const OutboxContext = createContext<OutboxContextValue | null>(null);

const STORAGE_KEY = "ananta.outbox.v1";

function nowUtcIso(): string {
  return new Date().toISOString();
}

function loadOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as OutboxItem[];
  } catch {
    return [];
  }
}

function persistOutbox(items: OutboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore write failures (quota/private mode)
  }
}

function statusFromDecisionMeta(decision: DecisionMeta): OutboxItemStatus {
  if (decision.ok) return "PENDING_LOCAL";

  if (decision.resolution_mode === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  if (decision.resolution_mode === "RETRY_LATER") return "RETRY_LATER";
  return "REJECTED";
}

function toCandidate(item: OutboxItem): EventCandidate {
  return {
    protocol_pin: item.protocol_pin_at_creation,
    idempotency_key: item.idempotency_key,
    event_type: item.event_type,
    target: item.target,
    payload: item.payload
  };
}

export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<OutboxItem[]>(() => loadOutbox());
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
    persistOutbox(items);
  }, [items]);

  const updateItem = useCallback((localId: string, patch: Partial<OutboxItem>) => {
    setItems((prev) => prev.map((it) => (it.local_id === localId ? { ...it, ...patch } : it)));
  }, []);

  const createItem: OutboxContextValue["createItem"] = useCallback(
    (input) => {
      const localId = ulid();
      const item: OutboxItem = {
        local_id: localId,
        created_at_device_utc: nowUtcIso(),
        protocol_pin_at_creation: input.protocol_pin_at_creation,
        target: input.target,
        event_type: input.event_type,
        idempotency_key: localId,
        payload: input.payload,
        status: "PENDING_LOCAL",
        attempt_count: 0
      };

      setItems((prev) => [item, ...prev]);
      return item;
    },
    [setItems]
  );

  const runDryRun = useCallback(
    async (localId: string, backend: Backend, candidateOverride?: EventCandidate) => {
      setItems((prev) =>
        prev.map((it) =>
          it.local_id === localId
            ? {
                ...it,
                status: "SENDING",
                attempt_count: (it.attempt_count ?? 0) + 1,
                last_error: undefined
              }
            : it
        )
      );

      try {
        const snapshot = itemsRef.current.find((it) => it.local_id === localId);
        const candidate = candidateOverride ?? (snapshot ? toCandidate(snapshot) : undefined);
        if (!candidate) return;

        const decision = await backend.dryRunEvent(candidate);
        updateItem(localId, {
          dry_run_result: decision,
          status: statusFromDecisionMeta(decision),
          last_error: undefined
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dry-run failed";
        updateItem(localId, { status: "RETRY_LATER", last_error: message });
      }
    },
    [updateItem]
  );

  const value = useMemo(
    () => ({
      items,
      createItem,
      updateItem,
      runDryRun
    }),
    [items, createItem, updateItem, runDryRun]
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxContextValue {
  const ctx = useContext(OutboxContext);
  if (!ctx) throw new Error("useOutbox must be used within OutboxProvider");
  return ctx;
}
