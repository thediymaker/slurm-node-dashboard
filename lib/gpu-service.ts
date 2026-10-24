// GPU utilization lookups and the capture that saves per-job GPU metrics to
// the database. Used by /api/gpu and the built-in GPU history collector.

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { getMetricsDb } from "@/lib/metrics-db";
import { expandNodePatterns, getExcludedNodeSet, loadDashboardConfig } from "@/lib/node-config";
import { getFeatures } from "@/lib/features";
import {
  buildGpuMetricsFilter,
  extractNumericValue,
  extractValue,
  checkRecordingRulesAvailable,
  getGpuMetricsLabelFilter,
  promSelector,
} from "@/lib/gpu-metrics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GPUJobData {
  jobId: string;
  avgUtilization: number;
  memoryPct: number;
  gpuCount: number;
  isUnderutilized: boolean;
  source?: "prometheus" | "database";
  isComplete?: boolean;
}

export type GPUJobSourceMode = "auto" | "database";

interface GPUOverviewData {
  avgUtilization: number;
  memoryUtilization: number;
  totalGPUs: number;
  totalJobs: number;
  underutilizedJobs: number;
}

interface GPUJobMetric {
  jobId: string;
  avgUtilization: number;
  maxUtilization: number;
  minUtilization: number;
  avgMemoryPct: number;
  maxMemoryPct: number;
  gpuCount: number;
  hostnames: string[];
  instances: string[];
}

interface CaptureDryRunJob {
  jobId: string;
  action: "insert" | "update";
  avgUtilization: number;
  maxUtilization: number;
  minUtilization: number;
  avgMemoryPct: number;
  maxMemoryPct: number;
  gpuCount: number;
  hostnames: string[];
  instances: string[];
  existing?: {
    isComplete: boolean;
    lastSeen: string | null;
    sampleCount: number;
  };
}

interface CaptureDebug {
  selector: string;
  selectorSource: string;
  nodeFilterCount?: number;
  prometheus: {
    utilizationSeries: number;
    memoryUsedSeries: number;
    memoryFreeSeries: number;
  };
  jobs: CaptureDryRunJob[];
  wouldMarkCompleteTotal: number;
  wouldMarkCompleteSample: Array<{
    jobId: string;
    lastSeen: string | null;
    sampleCount: number;
  }>;
}

export interface CaptureResult {
  status: number;
  message: string;
  captured?: number;
  updated?: number;
  markedComplete?: number;
  errors?: string[];
  rateLimited?: boolean;
  nextCaptureIn?: number;
  dryRun?: boolean;
  selector?: string;
  selectorSource?: string;
  nodeFilterCount?: number;
  debug?: CaptureDebug;
}

// ─── Shared Query Helpers ────────────────────────────────────────────────────

// Under the 60s capture interval: a capture saves its samples a moment after it
// starts, so a 60s limit would reject every other scheduled run
const RATE_LIMIT_SECONDS = 50;
type MetricsPool = NonNullable<ReturnType<typeof getMetricsDb>>;
type PrometheusValue = [number | string, string] | { value: string | number } | string | number | null | undefined;
type PrometheusLabels = Record<string, string | undefined>;
type PrometheusMetric = PrometheusLabels & { labels?: PrometheusLabels };

interface PrometheusSeriesItem {
  metric?: PrometheusMetric;
  value?: PrometheusValue;
}

interface PrometheusInstantResult {
  result?: PrometheusSeriesItem[];
}

interface CaptureSelector {
  filter: string;
  source: "capture-env" | "metrics-env" | "node-config" | "none";
  nodeFilterCount?: number;
}

interface ExistingGpuMetricRow {
  job_id: string;
  is_complete: boolean;
  last_seen: Date | string | null;
  sample_count: number | string | null;
}

let didWarnMissingGpuMetricsTable = false;
let didWarnMissingCaptureToken = false;
let didWarnUnscopedGpuCapture = false;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingGpuMetricsTableError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

function missingGpuMetricsTableMessage() {
  return "GPU metrics table is not initialized. Run slurm-history-ingestor/db/migrations/003_add_gpu_metrics.sql against the metrics database, or restart the updated ingestor so embedded migrations run.";
}

function warnMissingGpuMetricsTable() {
  if (didWarnMissingGpuMetricsTable) return;
  console.warn(missingGpuMetricsTableMessage());
  didWarnMissingGpuMetricsTable = true;
}

function missingGpuMetricsTableResponse(status = 404) {
  warnMissingGpuMetricsTable();
  return NextResponse.json({
    status,
    message: missingGpuMetricsTableMessage(),
  });
}

async function gpuMetricsTableExists(pool: MetricsPool) {
  const result = await pool.query("SELECT to_regclass('job_gpu_metrics') AS table_name");
  return result.rows[0]?.table_name === "job_gpu_metrics";
}

function normalizePromLabelFilter(filter: string) {
  return filter.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
}

function escapePromString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeRegex(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function addUniqueValue(values: string[], value?: string) {
  if (value && value !== "unknown" && !values.includes(value)) {
    values.push(value);
  }
}

function getMetricLabels(item: PrometheusSeriesItem): PrometheusLabels {
  return item.metric?.labels || item.metric || {};
}

function getHostname(labels: PrometheusLabels) {
  return labels.Hostname || labels.hostname || "unknown";
}

function getInstance(labels: PrometheusLabels) {
  return labels.instance || "unknown";
}

function getGpuKeyHost(labels: PrometheusLabels) {
  return labels.Hostname || labels.hostname || labels.instance || "unknown";
}

function formatDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

async function buildCaptureSelector(): Promise<CaptureSelector> {
  const captureFilter = normalizePromLabelFilter(
    process.env.GPU_METRICS_CAPTURE_LABEL_FILTER || ""
  );

  if (captureFilter) {
    return {
      filter: `hpc_job!="0", hpc_job!="", ${captureFilter}`,
      source: "capture-env",
    };
  }

  const globalFilter = getGpuMetricsLabelFilter();
  if (globalFilter) {
    return {
      filter: buildGpuMetricsFilter(['hpc_job!="0"', 'hpc_job!=""']),
      source: "metrics-env",
    };
  }

  const config = await loadDashboardConfig();
  const configuredNodes = Object.values(config.rackLayout).flatMap(
    (rack) => rack.nodes || []
  );
  const excludedNodes = getExcludedNodeSet(config);
  const nodeNames = Array.from(
    new Set(
      expandNodePatterns(configuredNodes)
        .map((node) => node.trim())
        .filter((node) => node && !excludedNodes.has(node))
    )
  ).sort();

  if (nodeNames.length > 0) {
    const hostRegex = `^(${nodeNames.map(escapeRegex).join("|")})$`;

    return {
      filter: `hpc_job!="0", hpc_job!="", Hostname=~"${escapePromString(hostRegex)}"`,
      source: "node-config",
      nodeFilterCount: nodeNames.length,
    };
  }

  if (!didWarnUnscopedGpuCapture) {
    console.warn("GPU metrics capture is unscoped. Set GPU_METRICS_CLUSTER, GPU_METRICS_LABEL_FILTER, GPU_METRICS_CAPTURE_LABEL_FILTER, or configure infra/node.cfg to avoid capturing jobs from other clusters in a shared Prometheus.");
    didWarnUnscopedGpuCapture = true;
  }

  return {
    filter: 'hpc_job!="0", hpc_job!=""',
    source: "none",
  };
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest();
}

function tokensMatch(actual: string, expected: string) {
  return timingSafeEqual(tokenDigest(actual), tokenDigest(expected));
}

function getCaptureTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return req.headers.get("x-api-key")?.trim() || "";
}

export function validateCaptureAuth(req: Request): NextResponse<CaptureResult> | null {
  const expectedToken = process.env.GPU_METRICS_CAPTURE_TOKEN?.trim();

  if (!expectedToken) {
    if (!didWarnMissingCaptureToken) {
      console.warn("GPU metrics capture is not protected. Set GPU_METRICS_CAPTURE_TOKEN to require a secret for POST /api/gpu.");
      didWarnMissingCaptureToken = true;
    }
    return null;
  }

  const providedToken = getCaptureTokenFromRequest(req);

  if (!providedToken || !tokensMatch(providedToken, expectedToken)) {
    return NextResponse.json(
      {
        status: 401,
        message: "Unauthorized",
      },
      { status: 401 }
    );
  }

  return null;
}

const queryDirectUtilValues = async (filter: string): Promise<number[]> => {
  const result = await prom!.instantQuery(`DCGM_FI_DEV_GPU_UTIL{${filter}}`) as PrometheusInstantResult;
  const utilValues: number[] = [];

  if (result?.result && Array.isArray(result.result)) {
    for (const item of result.result) {
      const labels = getMetricLabels(item);
      const jobId = labels.hpc_job;
      if (jobId && jobId !== "0" && jobId !== "") {
        const val = extractNumericValue(item.value);
        if (!isNaN(val)) utilValues.push(val);
      }
    }
  }

  return utilValues;
};

function countSeries(result: PrometheusInstantResult | null) {
  return Array.isArray(result?.result) ? result.result.length : 0;
}

const queryDirectMemory = async (filter: string): Promise<number> => {
  const memUsedResult = await prom!.instantQuery(`DCGM_FI_DEV_FB_USED{${filter}}`) as PrometheusInstantResult;
  const memFreeResult = await prom!.instantQuery(`DCGM_FI_DEV_FB_FREE{${filter}}`) as PrometheusInstantResult;

  if (!memUsedResult?.result || !memFreeResult?.result) return 0;

  let totalUsed = 0;
  let totalMem = 0;

  for (let i = 0; i < memUsedResult.result.length; i++) {
    const used = extractNumericValue(memUsedResult.result[i]?.value);
    const freeItem = memFreeResult.result[i];
    const free = freeItem?.value ? extractNumericValue(freeItem.value) : 0;
    if (!isNaN(used) && !isNaN(free)) {
      totalUsed += used;
      totalMem += used + free;
    }
  }

  return totalMem > 0 ? (totalUsed / totalMem) * 100 : 0;
};

// ─── GET: Per-Job or Overview ────────────────────────────────────────────────

export async function handleJobQuery(jobId: string, sourceMode: GPUJobSourceMode = "auto"): Promise<NextResponse> {
  if (sourceMode === "database") {
    const dbData = await queryJobFromDatabase(jobId);
    if (dbData) {
      return NextResponse.json({ status: 200, data: dbData });
    }

    return NextResponse.json({
      status: 404,
      message: `No historical GPU metrics found for job ${jobId}`,
    });
  }

  const jobFilter = buildGpuMetricsFilter([`hpc_job="${jobId}"`]);

  // Strategy: recording rules → direct DCGM → database fallback
  if (prom) {
    const hasRules = await checkRecordingRulesAvailable(jobId, jobFilter);

    if (hasRules) {
      const data = await queryJobWithRecordingRules(jobId, jobFilter);
      return NextResponse.json({ status: 200, data });
    }

    const data = await queryJobDirect(jobId, jobFilter);
    if (data) {
      return NextResponse.json({ status: 200, data });
    }
  }

  const dbData = await queryJobFromDatabase(jobId);
  if (dbData) {
    return NextResponse.json({ status: 200, data: dbData });
  }

  return NextResponse.json({
    status: 404,
    message: `No GPU metrics found for job ${jobId}`,
  });
}

async function queryJobWithRecordingRules(jobId: string, jobFilter: string): Promise<GPUJobData> {
  const [avgResult, memResult, countResult, underutilResult] = await Promise.all([
    prom!.instantQuery(promSelector("job:gpu_utilization:current_avg", jobFilter)).catch(() => null),
    prom!.instantQuery(promSelector("job:gpu_memory:current_avg_pct", jobFilter)).catch(() => null),
    prom!.instantQuery(promSelector("job:gpu_count:current", jobFilter)).catch(() => null),
    prom!.instantQuery(promSelector("job:gpu_underutilized:bool", jobFilter)).catch(() => null),
  ]);

  const avgUtilization = extractValue(avgResult) ?? 0;

  return {
    jobId,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    memoryPct: Math.round((extractValue(memResult) ?? 0) * 10) / 10,
    gpuCount: extractValue(countResult) ?? 1,
    isUnderutilized: extractValue(underutilResult) === 1 || avgUtilization < 30,
    source: "prometheus",
  };
}

async function queryJobDirect(jobId: string, jobFilter: string): Promise<GPUJobData | null> {
  const utilValues = await queryDirectUtilValues(jobFilter);
  if (utilValues.length === 0) return null;

  const avgUtilization = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;

  const memoryPct = await queryDirectMemory(jobFilter).catch(() => 0);

  return {
    jobId,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    memoryPct: Math.round(memoryPct * 10) / 10,
    gpuCount: utilValues.length,
    isUnderutilized: avgUtilization < 30,
    source: "prometheus",
  };
}

export async function queryJobFromDatabase(jobId: string): Promise<GPUJobData | null> {
  if (!(await getFeatures()).gpuHistory.enabled) return null;

  const pool = getMetricsDb();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT job_id, avg_utilization, max_utilization, avg_memory_pct, gpu_count, is_complete
       FROM job_gpu_metrics WHERE job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const avgUtilization = parseFloat(row.avg_utilization);

    return {
      jobId: row.job_id,
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      memoryPct: Math.round(parseFloat(row.avg_memory_pct) * 10) / 10,
      gpuCount: parseInt(row.gpu_count),
      isUnderutilized: avgUtilization < 30,
      source: "database",
      isComplete: row.is_complete,
    };
  } catch (error) {
    if (isMissingGpuMetricsTableError(error)) {
      warnMissingGpuMetricsTable();
      return null;
    }
    console.error(`Error querying GPU metrics from database for job ${jobId}:`, error);
    return null;
  }
}

// ─── GET: Cluster Overview (Database-backed) ────────────────────────────────

export async function handleOverview(from?: string, to?: string): Promise<NextResponse> {
  const gpuHistory = (await getFeatures()).gpuHistory;
  if (!gpuHistory.enabled) {
    return NextResponse.json({ status: 404, message: `GPU history is off: ${gpuHistory.reason}` });
  }

  const pool = getMetricsDb();
  if (!pool) {
    return NextResponse.json({ status: 404, message: "Metrics database is not configured" });
  }

  try {
    if (!(await gpuMetricsTableExists(pool))) {
      return missingGpuMetricsTableResponse();
    }

    const conditions: string[] = [];
    const params: Array<Date | string> = [];
    let paramIndex = 1;

    if (from) {
      conditions.push(`last_seen >= $${paramIndex}`);
      params.push(new Date(from));
      paramIndex++;
    }
    if (to) {
      conditions.push(`first_seen <= $${paramIndex}`);
      params.push(new Date(to));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        COUNT(*) as total_jobs,
        COALESCE(AVG(avg_utilization), 0) as avg_utilization,
        COALESCE(AVG(avg_memory_pct), 0) as memory_utilization,
        COALESCE(SUM(gpu_count), 0) as total_gpus,
        COUNT(*) FILTER (WHERE avg_utilization < 30) as underutilized_jobs
       FROM job_gpu_metrics
       ${whereClause}`,
      params
    );

    const row = result.rows[0];
    const totalJobs = parseInt(row.total_jobs) || 0;

    if (totalJobs === 0) {
      return NextResponse.json({ status: 404, message: "No GPU jobs found in database" });
    }

    const data: GPUOverviewData = {
      avgUtilization: Math.round(parseFloat(row.avg_utilization) * 10) / 10,
      memoryUtilization: Math.round(parseFloat(row.memory_utilization) * 10) / 10,
      totalGPUs: parseInt(row.total_gpus) || 0,
      totalJobs,
      underutilizedJobs: parseInt(row.underutilized_jobs) || 0,
    };

    return NextResponse.json({ status: 200, data, source: "database" });
  } catch (error) {
    if (isMissingGpuMetricsTableError(error)) {
      return missingGpuMetricsTableResponse();
    }

    console.error("Error querying GPU overview from database:", error);
    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU overview metrics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── POST: Capture GPU Metrics ───────────────────────────────────────────────

const extractCaptureJobMetrics = (
  utilResult: PrometheusInstantResult | null,
  memUsedResult: PrometheusInstantResult | null,
  memFreeResult: PrometheusInstantResult | null
): Map<string, GPUJobMetric> => {
  const jobMetrics = new Map<string, GPUJobMetric>();

  if (!utilResult?.result || !Array.isArray(utilResult.result)) {
    return jobMetrics;
  }

  const memUsedByGpu = new Map<string, number>();
  const memTotalByGpu = new Map<string, number>();

  if (memUsedResult?.result && memFreeResult?.result) {
    for (const item of memUsedResult.result) {
      const labels = getMetricLabels(item);
      const gpuKey = `${getGpuKeyHost(labels)}-${labels.gpu || labels.GPU_I_ID}`;
      const used = extractNumericValue(item.value);
      if (!isNaN(used)) memUsedByGpu.set(gpuKey, used);
    }
    for (const item of memFreeResult.result) {
      const labels = getMetricLabels(item);
      const gpuKey = `${getGpuKeyHost(labels)}-${labels.gpu || labels.GPU_I_ID}`;
      const free = extractNumericValue(item.value);
      const used = memUsedByGpu.get(gpuKey) || 0;
      if (!isNaN(free)) memTotalByGpu.set(gpuKey, used + free);
    }
  }

  for (const item of utilResult.result) {
    const labels = getMetricLabels(item);
    const jobId = labels.hpc_job;

    if (!jobId || jobId === "0" || jobId === "") continue;

    const utilValue = extractNumericValue(item.value);
    if (isNaN(utilValue)) continue;

    const hostname = getHostname(labels);
    const instance = getInstance(labels);
    const gpuKey = `${getGpuKeyHost(labels)}-${labels.gpu || labels.GPU_I_ID}`;
    const memUsed = memUsedByGpu.get(gpuKey) || 0;
    const memTotal = memTotalByGpu.get(gpuKey) || 1;
    const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

    if (!jobMetrics.has(jobId)) {
      jobMetrics.set(jobId, {
        jobId,
        avgUtilization: utilValue,
        maxUtilization: utilValue,
        minUtilization: utilValue,
        avgMemoryPct: memPct,
        maxMemoryPct: memPct,
        gpuCount: 1,
        hostnames: hostname === "unknown" ? [] : [hostname],
        instances: instance === "unknown" ? [] : [instance],
      });
    } else {
      const existing = jobMetrics.get(jobId)!;
      const newCount = existing.gpuCount + 1;
      existing.avgUtilization = (existing.avgUtilization * existing.gpuCount + utilValue) / newCount;
      existing.maxUtilization = Math.max(existing.maxUtilization, utilValue);
      existing.minUtilization = Math.min(existing.minUtilization, utilValue);
      existing.avgMemoryPct = (existing.avgMemoryPct * existing.gpuCount + memPct) / newCount;
      existing.maxMemoryPct = Math.max(existing.maxMemoryPct, memPct);
      existing.gpuCount = newCount;
      addUniqueValue(existing.hostnames, hostname);
      addUniqueValue(existing.instances, instance);
    }
  }

  return jobMetrics;
};

async function buildCaptureDryRunDebug(
  pool: MetricsPool,
  selector: CaptureSelector,
  jobMetrics: Map<string, GPUJobMetric>,
  currentJobIds: Set<string>,
  utilResult: PrometheusInstantResult | null,
  memUsedResult: PrometheusInstantResult | null,
  memFreeResult: PrometheusInstantResult | null
): Promise<CaptureDebug> {
  const jobIds = Array.from(currentJobIds);
  const existingJobs = new Map<string, ExistingGpuMetricRow>();

  if (jobIds.length > 0) {
    const existingResult = await pool.query(
      `SELECT job_id, is_complete, last_seen, sample_count
       FROM job_gpu_metrics
       WHERE job_id = ANY($1::text[])`,
      [jobIds]
    );

    for (const row of existingResult.rows as ExistingGpuMetricRow[]) {
      existingJobs.set(row.job_id, row);
    }
  }

  const completeCountResult = await pool.query(
    `SELECT COUNT(*) AS count
     FROM job_gpu_metrics
     WHERE is_complete = false
       AND last_seen < NOW() - INTERVAL '10 minutes'
       AND job_id NOT IN (SELECT unnest($1::text[]))`,
    [jobIds]
  );

  const completeSampleResult = await pool.query(
    `SELECT job_id, last_seen, sample_count
     FROM job_gpu_metrics
     WHERE is_complete = false
       AND last_seen < NOW() - INTERVAL '10 minutes'
       AND job_id NOT IN (SELECT unnest($1::text[]))
     ORDER BY last_seen ASC
     LIMIT 100`,
    [jobIds]
  );

  const jobs = Array.from(jobMetrics.values())
    .sort((a, b) => a.jobId.localeCompare(b.jobId, undefined, { numeric: true }))
    .map((metrics): CaptureDryRunJob => {
      const existing = existingJobs.get(metrics.jobId);

      return {
        jobId: metrics.jobId,
        action: existing ? "update" : "insert",
        avgUtilization: Math.round(metrics.avgUtilization * 10) / 10,
        maxUtilization: Math.round(metrics.maxUtilization * 10) / 10,
        minUtilization: Math.round(metrics.minUtilization * 10) / 10,
        avgMemoryPct: Math.round(metrics.avgMemoryPct * 10) / 10,
        maxMemoryPct: Math.round(metrics.maxMemoryPct * 10) / 10,
        gpuCount: metrics.gpuCount,
        hostnames: metrics.hostnames,
        instances: metrics.instances,
        existing: existing
          ? {
              isComplete: existing.is_complete,
              lastSeen: formatDate(existing.last_seen),
              sampleCount: parseInt(String(existing.sample_count || 0), 10),
            }
          : undefined,
      };
    });

  return {
    selector: selector.filter,
    selectorSource: selector.source,
    nodeFilterCount: selector.nodeFilterCount,
    prometheus: {
      utilizationSeries: countSeries(utilResult),
      memoryUsedSeries: countSeries(memUsedResult),
      memoryFreeSeries: countSeries(memFreeResult),
    },
    jobs,
    wouldMarkCompleteTotal: parseInt(completeCountResult.rows[0]?.count || "0", 10),
    wouldMarkCompleteSample: (completeSampleResult.rows as ExistingGpuMetricRow[]).map((row) => ({
      jobId: row.job_id,
      lastSeen: formatDate(row.last_seen),
      sampleCount: parseInt(String(row.sample_count || 0), 10),
    })),
  };
}

export async function handleCapture({ dryRun = false }: { dryRun?: boolean } = {}): Promise<NextResponse<CaptureResult>> {
  const gpuHistory = (await getFeatures()).gpuHistory;
  if (!gpuHistory.enabled) {
    return NextResponse.json({
      status: 400,
      message: `GPU history is off: ${gpuHistory.reason}`,
    });
  }

  const pool = getMetricsDb();
  if (!pool) {
    return NextResponse.json({
      status: 500,
      message: "Database is not configured (DATABASE_URL not set).",
    });
  }

  if (!prom) {
    return NextResponse.json({
      status: 500,
      message: "Prometheus is not configured (PROMETHEUS_URL not set).",
    });
  }

  const selector = await buildCaptureSelector();

  try {
    if (!(await gpuMetricsTableExists(pool))) {
      return missingGpuMetricsTableResponse(500);
    }

    if (!dryRun) {
      const lastCaptureResult = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_seen))) as seconds_since_last
         FROM job_gpu_metrics
         WHERE is_complete = false`
      );

      const secondsSinceLast = lastCaptureResult.rows[0]?.seconds_since_last;

      if (secondsSinceLast !== null && secondsSinceLast < RATE_LIMIT_SECONDS) {
        const nextCaptureIn = Math.ceil(RATE_LIMIT_SECONDS - secondsSinceLast);
        return NextResponse.json({
          status: 429,
          message: `Rate limited. Last capture was ${Math.round(secondsSinceLast)}s ago.`,
          rateLimited: true,
          nextCaptureIn,
          selector: selector.filter,
          selectorSource: selector.source,
          nodeFilterCount: selector.nodeFilterCount,
        });
      }
    }
  } catch (err) {
    console.warn("Rate limit check failed, proceeding with capture:", err);
  }

  const errors: string[] = [];
  let captured = 0;
  let updated = 0;
  let markedComplete = 0;

  try {
    const utilQuery = `DCGM_FI_DEV_GPU_UTIL{${selector.filter}}`;
    const memUsedQuery = `DCGM_FI_DEV_FB_USED{${selector.filter}}`;
    const memFreeQuery = `DCGM_FI_DEV_FB_FREE{${selector.filter}}`;

    const [utilResult, memUsedResult, memFreeResult] = await Promise.all([
      prom.instantQuery(utilQuery).catch((e: unknown) => {
        errors.push(`Utilization query failed: ${getErrorMessage(e)}`);
        return null;
      }) as Promise<PrometheusInstantResult | null>,
      prom.instantQuery(memUsedQuery).catch((e: unknown) => {
        errors.push(`Memory used query failed: ${getErrorMessage(e)}`);
        return null;
      }) as Promise<PrometheusInstantResult | null>,
      prom.instantQuery(memFreeQuery).catch((e: unknown) => {
        errors.push(`Memory free query failed: ${getErrorMessage(e)}`);
        return null;
      }) as Promise<PrometheusInstantResult | null>,
    ]);

    if (!utilResult) {
      return NextResponse.json({
        status: 500,
        message: "Failed to query GPU utilization from Prometheus",
        errors,
      });
    }

    const jobMetrics = extractCaptureJobMetrics(utilResult, memUsedResult, memFreeResult);
    const currentJobIds = new Set(jobMetrics.keys());

    if (dryRun) {
      const debug = await buildCaptureDryRunDebug(
        pool,
        selector,
        jobMetrics,
        currentJobIds,
        utilResult,
        memUsedResult,
        memFreeResult
      );

      return NextResponse.json({
        status: 200,
        message: "GPU metrics capture dry run",
        dryRun: true,
        captured: debug.jobs.filter((job) => job.action === "insert").length,
        updated: debug.jobs.filter((job) => job.action === "update").length,
        markedComplete: debug.wouldMarkCompleteTotal,
        selector: selector.filter,
        selectorSource: selector.source,
        nodeFilterCount: selector.nodeFilterCount,
        errors: errors.length > 0 ? errors : undefined,
        debug,
      });
    }

    for (const [jobId, metrics] of jobMetrics) {
      try {
        const result = await pool.query(
          `INSERT INTO job_gpu_metrics (
            job_id, avg_utilization, max_utilization, min_utilization,
            avg_memory_pct, max_memory_pct, gpu_count, sample_count,
            first_seen, last_seen, is_complete
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW(), false)
          ON CONFLICT (job_id) DO UPDATE SET
            avg_utilization = (
              job_gpu_metrics.avg_utilization * job_gpu_metrics.sample_count + $2
            ) / (job_gpu_metrics.sample_count + 1),
            max_utilization = GREATEST(job_gpu_metrics.max_utilization, $3),
            min_utilization = LEAST(job_gpu_metrics.min_utilization, $4),
            avg_memory_pct = (
              job_gpu_metrics.avg_memory_pct * job_gpu_metrics.sample_count + $5
            ) / (job_gpu_metrics.sample_count + 1),
            max_memory_pct = GREATEST(job_gpu_metrics.max_memory_pct, $6),
            gpu_count = GREATEST(job_gpu_metrics.gpu_count, $7),
            sample_count = job_gpu_metrics.sample_count + 1,
            last_seen = NOW(),
            is_complete = false
          RETURNING (xmax = 0) as inserted`,
          [
            jobId,
            metrics.avgUtilization,
            metrics.maxUtilization,
            metrics.minUtilization,
            metrics.avgMemoryPct,
            metrics.maxMemoryPct,
            metrics.gpuCount,
          ]
        );

        if (result.rows[0]?.inserted) {
          captured++;
        } else {
          updated++;
        }
      } catch (err: unknown) {
        errors.push(`Failed to upsert job ${jobId}: ${getErrorMessage(err)}`);
      }
    }

    try {
      const completeResult = await pool.query(
        `UPDATE job_gpu_metrics
         SET is_complete = true
         WHERE is_complete = false
           AND last_seen < NOW() - INTERVAL '10 minutes'
           AND job_id NOT IN (SELECT unnest($1::text[]))
         RETURNING job_id`,
        [Array.from(currentJobIds)]
      );
      markedComplete = completeResult.rowCount || 0;
    } catch (err: unknown) {
      errors.push(`Failed to mark complete jobs: ${getErrorMessage(err)}`);
    }

    return NextResponse.json({
      status: 200,
      message: "GPU metrics capture complete",
      captured,
      updated,
      markedComplete,
      selector: selector.filter,
      selectorSource: selector.source,
      nodeFilterCount: selector.nodeFilterCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error("GPU metrics capture error:", error);
    return NextResponse.json({
      status: 500,
      message: "Error capturing GPU metrics",
      errors: [...errors, getErrorMessage(error)],
    });
  }
}
