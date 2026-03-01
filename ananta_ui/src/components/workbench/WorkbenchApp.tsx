"use client";

import { useMemo, useState } from "react";

import { BackendProvider } from "@/rails/backendStore";
import type { ModeId } from "@/rails/mode";
import type { NodeRef } from "@/rails/nodeRef";
import { OutboxProvider } from "@/runtime/outboxStore";

import { WorkbenchShell } from "./WorkbenchShell";

export function WorkbenchApp({
  initialMode,
  initialNode
}: {
  initialMode: ModeId;
  initialNode: NodeRef | null;
}) {
  const mode = initialMode;
  const node = initialNode;

  // Key forces shell refresh on deep-link changes while keeping runtime providers stable.
  const shellKey = useMemo(() => `${mode}:${node ? `${node.type}:${node.id}` : "none"}`, [mode, node]);
  const [mountedAt] = useState(() => Date.now());

  return (
    <BackendProvider>
      <OutboxProvider>
        <WorkbenchShell key={shellKey} mode={mode} node={node} mountedAt={mountedAt} />
      </OutboxProvider>
    </BackendProvider>
  );
}

