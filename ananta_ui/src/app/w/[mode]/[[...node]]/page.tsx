import { WorkbenchApp } from "@/components/workbench/WorkbenchApp";
import { isModeId, type ModeId } from "@/rails/mode";
import type { NodeRef } from "@/rails/nodeRef";
import { isNodeType } from "@/rails/nodeRef";

function parseNode(node: string[] | undefined): NodeRef | null {
  if (!node || node.length === 0) return null;
  if (node.length !== 2) return null;
  const [type, id] = node;
  if (!type || !id) return null;
  if (!isNodeType(type)) return null;
  return { type, id };
}

export default function WorkbenchPage({
  params
}: {
  params: { mode: string; node?: string[] };
}) {
  const mode: ModeId = isModeId(params.mode) ? params.mode : "execute-operator";
  return (
    <WorkbenchApp
      initialMode={mode}
      initialNode={parseNode(params.node)}
    />
  );
}
