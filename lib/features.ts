import fs from "fs/promises";
import path from "path";
import { getDatabaseUrl, getModulesFile, readEnv, readFlag } from "@/lib/config";
import { ensureSchema, getDb } from "@/lib/db";

// Which optional features are on, and why not when they're off.
//
// A feature turns on by itself when what it needs is configured. Its flag can
// turn it off (FLAG=false); the AI assistant and GPU utilization also need
// FLAG=true because they depend on services we can't detect.
//
// Without a database: the live cluster views, Modules, Prometheus charts,
// live GPU utilization and the AI assistant. Rewind also works from snapshot
// files written by the pre-3.0 cron script.
// With a database: Rewind (built-in snapshots), node history and GPU history.
// Job metrics also need the history ingestor writing job_history.

export type FeatureId =
  | "modules"
  | "prometheus"
  | "gpu"
  | "ai"
  | "rewind"
  | "nodeHistory"
  | "gpuHistory"
  | "jobMetrics";

export interface FeatureState {
  id: FeatureId;
  name: string;
  enabled: boolean;
  // Why it's off, or what it's running on when it's on
  reason: string;
  needsDatabase: boolean;
  flag?: string;
}

export type Features = Record<FeatureId, FeatureState>;

// What every page gets. Reasons can name internal hosts or database errors,
// so they only go to the admin page.
export type ClientFeatures = Record<FeatureId, { enabled: boolean }>;

export function toClientFeatures(features: Features): ClientFeatures {
  return Object.fromEntries(
    Object.values(features).map((f) => [f.id, { enabled: f.enabled }])
  ) as ClientFeatures;
}

export interface DatabaseStatus {
  configured: boolean;
  reachable: boolean;
  error?: string;
  // The dashboard's own tables (node history, snapshots, cluster capacity)
  schema: "ready" | "failed" | "disabled";
  schemaError?: string;
  tables: {
    jobHistory: boolean;
    gpuMetrics: boolean;
    nodeEvents: boolean;
    nodeStateTime: boolean;
    nodeSnapshots: boolean;
    clusterCapacity: boolean;
  };
  // Optional job_history columns added by later ingestor releases
  columns: { totalCpuSeconds: boolean };
}

const CACHE_MS = 30_000;
// Longer when the database is unreachable, so at most one request a minute
// waits for the connect timeout
const UNREACHABLE_CACHE_MS = 60_000;
let cached: { at: number; value: DatabaseStatus } | undefined;

const TABLES_QUERY = `
  SELECT to_regclass('public.job_history') IS NOT NULL AS job_history,
         to_regclass('public.job_gpu_metrics') IS NOT NULL AS job_gpu_metrics,
         to_regclass('public.node_events') IS NOT NULL AS node_events,
         to_regclass('public.node_state_time') IS NOT NULL AS node_state_time,
         to_regclass('public.node_snapshots') IS NOT NULL AS node_snapshots,
         to_regclass('public.cluster_capacity') IS NOT NULL AS cluster_capacity,
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'job_history'
                   AND column_name = 'total_cpu_seconds') AS total_cpu_seconds`;

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (cached) {
    const ttl = cached.value.configured && !cached.value.reachable ? UNREACHABLE_CACHE_MS : CACHE_MS;
    if (Date.now() - cached.at < ttl) return cached.value;
  }

  const status: DatabaseStatus = {
    configured: Boolean(getDatabaseUrl()),
    reachable: false,
    schema: "disabled",
    tables: {
      jobHistory: false,
      gpuMetrics: false,
      nodeEvents: false,
      nodeStateTime: false,
      nodeSnapshots: false,
      clusterCapacity: false,
    },
    columns: { totalCpuSeconds: false },
  };

  const pool = getDb();
  if (pool) {
    try {
      // Reachable first, so a down database costs one connect timeout, not several
      await pool.query("SELECT 1");
      status.reachable = true;

      const schema = await ensureSchema();
      status.schema = schema.state === "ready" ? "ready" : schema.state === "failed" ? "failed" : "disabled";
      if (schema.state === "failed") status.schemaError = schema.error;

      const { rows } = await pool.query(TABLES_QUERY);
      status.tables = {
        jobHistory: rows[0].job_history,
        gpuMetrics: rows[0].job_gpu_metrics,
        nodeEvents: rows[0].node_events,
        nodeStateTime: rows[0].node_state_time,
        nodeSnapshots: rows[0].node_snapshots,
        clusterCapacity: rows[0].cluster_capacity,
      };
      status.columns = { totalCpuSeconds: rows[0].total_cpu_seconds };
    } catch (err) {
      status.error = (err as Error).message;
    }
  }

  cached = { at: Date.now(), value: status };
  return status;
}

export const LEGACY_SNAPSHOT_DIR = path.join(process.cwd(), "data");

async function hasLegacySnapshots(): Promise<boolean> {
  try {
    const files = await fs.readdir(LEGACY_SNAPSHOT_DIR);
    return files.some((f) => f.endsWith(".json.gz"));
  } catch {
    return false;
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(/*turbopackIgnore: true*/ file);
    return true;
  } catch {
    return false;
  }
}

function databaseProblem(db: DatabaseStatus): string | undefined {
  if (!db.configured) return "Set DATABASE_URL to turn this on.";
  if (!db.reachable) return `Database unreachable: ${db.error ?? "unknown error"}`;
  return undefined;
}

export async function getFeatures(): Promise<Features> {
  const [db, legacySnapshots, modulesFile] = await Promise.all([
    getDatabaseStatus(),
    hasLegacySnapshots(),
    fileExists(getModulesFile()),
  ]);
  const dbProblem = databaseProblem(db);
  const schemaProblem =
    dbProblem ??
    (db.schema === "failed" ? `Couldn't create the dashboard's tables: ${db.schemaError}` : undefined);
  const prometheusUrl = readEnv("PROMETHEUS_URL");

  // Shared shape: an explicit FLAG=false always wins
  const feature = (
    id: FeatureId,
    name: string,
    flag: string | undefined,
    needsDatabase: boolean,
    check: () => { enabled: boolean; reason: string }
  ): FeatureState => {
    if (flag && readFlag(flag) === false) {
      return { id, name, flag, needsDatabase, enabled: false, reason: `Turned off with ${flag}=false.` };
    }
    return { id, name, flag, needsDatabase, ...check() };
  };

  // No flag: before 3.0 NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN didn't control
  // Prometheus, and the shipped .env template sets it to "false"
  const prometheus = feature("prometheus", "Prometheus metrics", undefined, false, () =>
    prometheusUrl
      ? { enabled: true, reason: `Using ${prometheusUrl}.` }
      : { enabled: false, reason: "Set PROMETHEUS_URL to turn this on." }
  );

  const gpu = feature("gpu", "GPU utilization", "NEXT_PUBLIC_ENABLE_GPU_UTILIZATION", false, () => {
    if (readFlag("NEXT_PUBLIC_ENABLE_GPU_UTILIZATION") !== true)
      return { enabled: false, reason: "Needs DCGM exporter metrics in Prometheus; set NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=true." };
    if (!prometheus.enabled) return { enabled: false, reason: `Needs Prometheus. ${prometheus.reason}` };
    return { enabled: true, reason: "Live GPU utilization from DCGM metrics in Prometheus." };
  });

  const features: Features = {
    modules: feature("modules", "Modules", "NEXT_PUBLIC_ENABLE_MODULES_PLUGIN", false, () =>
      modulesFile
        ? { enabled: true, reason: `Reading ${getModulesFile()}.` }
        : { enabled: false, reason: "Add public/modules.json (Lmod spider output), or set MODULES_FILE, to turn this on." }
    ),
    prometheus,
    gpu,
    ai: feature("ai", "AI assistant", "NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN", false, () =>
      readFlag("NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN") === true
        ? { enabled: true, reason: "Using the configured OpenAI-compatible endpoint." }
        : { enabled: false, reason: "Set NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=true and configure a model endpoint." }
    ),
    rewind: feature("rewind", "Rewind", "NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN", true, () => {
      if (!schemaProblem && db.tables.nodeSnapshots)
        return { enabled: true, reason: "Hourly snapshots stored in the database." };
      if (legacySnapshots) return { enabled: true, reason: "Reading snapshot files from data/ (pre-3.0 cron script)." };
      return { enabled: false, reason: schemaProblem ?? "Snapshot table missing." };
    }),
    nodeHistory: feature("nodeHistory", "Node history", "ENABLE_NODE_HISTORY", true, () =>
      !schemaProblem && db.tables.nodeEvents && db.tables.nodeStateTime
        ? { enabled: true, reason: "Recording node states, and drain and down periods, in the database." }
        : { enabled: false, reason: schemaProblem ?? "Node history tables missing." }
    ),
    gpuHistory: feature("gpuHistory", "GPU history", "GPU_METRICS_HISTORY", true, () => {
      if (!gpu.enabled) return { enabled: false, reason: `Needs GPU utilization. ${gpu.reason}` };
      if (dbProblem) return { enabled: false, reason: dbProblem };
      if (!db.tables.gpuMetrics) return { enabled: false, reason: schemaProblem ?? "GPU metrics table missing." };
      return { enabled: true, reason: "Saving per-job GPU utilization so it's kept after jobs finish." };
    }),
    jobMetrics: feature("jobMetrics", "Job metrics", "NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN", true, () => {
      if (dbProblem) return { enabled: false, reason: dbProblem };
      if (!db.tables.jobHistory)
        return { enabled: false, reason: "No job history yet. Run slurm-history-ingestor against this database." };
      return { enabled: true, reason: "Reporting on job history written by slurm-history-ingestor." };
    }),
  };
  return features;
}

export async function isFeatureEnabled(id: FeatureId): Promise<boolean> {
  return (await getFeatures())[id].enabled;
}
