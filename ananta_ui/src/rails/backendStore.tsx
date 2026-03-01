"use client";

import React, { createContext, useContext, useMemo } from "react";

import type { Backend } from "@/rails/backend";
import { getBackend } from "@/rails/backend";

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const backend = useMemo(() => getBackend(), []);
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error("useBackend must be used within BackendProvider");
  return ctx;
}

