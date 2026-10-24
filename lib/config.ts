import path from "path";

// Runtime settings. Everything here is read from the environment when the
// server runs, not when the app is built, so one image works for every
// install. NEXT_PUBLIC_BASE_PATH is the exception: Next.js needs it at build.

// Next.js inlines `process.env.NEXT_PUBLIC_*` member expressions at build
// time; reading through a variable key keeps them runtime values.
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// true/false for an explicit setting, undefined when unset or unrecognized
export function readFlag(name: string): boolean | undefined {
  const value = readEnv(name)?.toLowerCase();
  if (value === undefined) return undefined;
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return undefined;
}

// Lmod spider output for the Modules page. MODULES_FILE lets a container
// mount it anywhere; infra/modules.example.json shows the format.
export function getModulesFile(): string {
  return readEnv("MODULES_FILE") ?? path.join(process.cwd(), "public", "modules.json");
}

// DATABASE_URL is the setting from 3.0 on; the old name still works
export function getDatabaseUrl(): string | undefined {
  return readEnv("DATABASE_URL") ?? readEnv("SLURM_JOB_METRICS_DATABASE_URL");
}

// The part of the configuration client components need. No secrets here:
// it's serialized into every page.
export interface PublicConfig {
  clusterName: string;
  clusterLogo?: string;
  supportUrl?: string;
  baseUrl?: string;
  metricsTimeZone: string;
  hierarchyLabels: { level1: string; level2: string };
}

export function getPublicConfig(): PublicConfig {
  return {
    clusterName: readEnv("CLUSTER_NAME") ?? "Cluster",
    clusterLogo: readEnv("CLUSTER_LOGO"),
    supportUrl: readEnv("NEXT_PUBLIC_SUPPORT_URL"),
    baseUrl: readEnv("NEXT_PUBLIC_BASE_URL"),
    metricsTimeZone: readEnv("NEXT_PUBLIC_METRICS_TIME_ZONE") ?? "America/Phoenix",
    hierarchyLabels: {
      level1: readEnv("NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL") ?? "College",
      level2: readEnv("NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL") ?? "Department",
    },
  };
}
