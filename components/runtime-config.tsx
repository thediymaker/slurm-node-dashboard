"use client";

import { createContext, useContext } from "react";
import type { PublicConfig } from "@/lib/config";
import type { ClientFeatures, FeatureId } from "@/lib/features";

export interface RuntimeConfig extends PublicConfig {
  features: ClientFeatures;
}

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

// Filled in by the root layout on every request, so client components see the
// server's current settings instead of values baked in at build time
export function RuntimeConfigProvider({
  value,
  children,
}: {
  value: RuntimeConfig;
  children: React.ReactNode;
}) {
  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig(): RuntimeConfig {
  const value = useContext(RuntimeConfigContext);
  if (!value) throw new Error("useRuntimeConfig must be used inside RuntimeConfigProvider");
  return value;
}

export function useFeature(id: FeatureId): boolean {
  return useRuntimeConfig().features[id].enabled;
}

export function useHierarchyLabels(): { level1: string; level2: string } {
  return useRuntimeConfig().hierarchyLabels;
}
