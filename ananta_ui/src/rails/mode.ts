export const MODE_IDS = [
  "execute-operator",
  "execute-supervisor",
  "ops-diagnostics",
  "merchant"
] as const;

export type ModeId = (typeof MODE_IDS)[number];

export type ModeMeta = {
  id: ModeId;
  label: string;
  shortLabel: string;
  allowTabs: boolean;
  readOnly: boolean;
};

export const MODE_META: Record<ModeId, ModeMeta> = {
  "execute-operator": {
    id: "execute-operator",
    label: "Execute (Operator)",
    shortLabel: "Operator",
    allowTabs: false,
    readOnly: false
  },
  "execute-supervisor": {
    id: "execute-supervisor",
    label: "Execute (Supervisor)",
    shortLabel: "Supervisor",
    allowTabs: true,
    readOnly: false
  },
  "ops-diagnostics": {
    id: "ops-diagnostics",
    label: "Ops Diagnostics",
    shortLabel: "Ops",
    allowTabs: true,
    readOnly: true
  },
  merchant: {
    id: "merchant",
    label: "Merchant",
    shortLabel: "Merchant",
    allowTabs: true,
    readOnly: true
  }
};

export function isModeId(value: string): value is ModeId {
  return (MODE_IDS as readonly string[]).includes(value);
}

