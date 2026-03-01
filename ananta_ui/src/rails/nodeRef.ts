import type { ModeId } from "@/rails/mode";

export const NODE_TYPES = [
  "trade",
  "shipment",
  "exception",
  "evidence",
  "outbox",
  "conflict"
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type NodeRef = {
  type: NodeType;
  id: string;
};

export function isNodeType(value: string): value is NodeType {
  return (NODE_TYPES as readonly string[]).includes(value);
}

export function nodeKey(node: NodeRef): string {
  return `${node.type}:${node.id}`;
}

export function nodeHref(mode: ModeId, node: NodeRef): string {
  return `/w/${mode}/${node.type}/${encodeURIComponent(node.id)}`;
}

