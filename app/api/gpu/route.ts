export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { getMetricsDb } from "@/lib/metrics-db";
import { jobMetricsPluginMetadata, gpuUtilizationPluginMetadata } from "@/actions/plugins";
import { extractNumericValue, extractValue, checkRecordingRulesAvailable } from "@/lib/gpu-metrics";

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
}

interface CaptureResult {
  status: number;
  message: string;
  captured?: number;
  updated?: number;
  markedComplete?: number;
  errors?: string[];
  rateLimited?: boolean;
  nextCaptureIn?: number;
}

// ─── Shared Query Helpers ────────────────────────────────────────────────────

const RATE_LIMIT_SECONDS = 60;

const queryDirectUtilValues = async (filter: string): Promise<{ utilValues: number[]; jobSet: Set<string>; totalGPUs: number; rawResult: any }> => {
  const result = await prom!.instantQuery(`DCGM_FI_DEV_GPU_UTIL{${filter}}`);
  const utilValues: number[] = [];
  const jobSet = new Set<string>();
  let totalGPUs = 0;

  if (result?.result && Array.isArray(result.result)) {
    for (const item of result.result) {
      const labels = item.metric?.labels || item.metric || {};
      const jobId = labels.hpc_job;
      if (jobId && jobId !== "0" && jobId !== "") {
        jobSet.add(jobId);
        totalGPUs++;
        const val = extractNumericValue(item.value);
        if (!isNaN(val)) utilValues.push(val);
      }
    }
  }

  return { utilValues, jobSet, totalGPUs, rawResult: result };
};

const queryDirectMemory = async (filter: string): Promise<number> => {
  const memUsedResult = await prom!.instantQuery(`DCGM_FI_DEV_FB_USED{${filter}}`);
  const memFreeResult = await prom!.instantQuery(`DCGM_FI_DEV_FB_FREE{${filter}}`);

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

async function handleJobQuery(jobId: string): Promise<NextResponse> {
  // Strategy: recording rules → direct DCGM → database fallback
  if (prom) {
    const hasRules = await checkRecordingRulesAvailable(jobId);

    if (hasRules) {
      const data = await queryJobWithRecordingRules(jobId);
      return NextResponse.json({ status: 200, data });
    }

    const data = await queryJobDirect(jobId);
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

async function queryJobWithRecordingRules(jobId: string): Promise<GPUJobData> {
  const [avgResult, memResult, countResult, underutilResult] = await Promise.all([
    prom!.instantQuery(`job:gpu_utilization:current_avg{hpc_job="${jobId}"}`).catch(() => null),
    prom!.instantQuery(`job:gpu_memory:current_avg_pct{hpc_job="${jobId}"}`).catch(() => null),
    prom!.instantQuery(`job:gpu_count:current{hpc_job="${jobId}"}`).catch(() => null),
    prom!.instantQuery(`job:gpu_underutilized:bool{hpc_job="${jobId}"}`).catch(() => null),
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

async function queryJobDirect(jobId: string): Promise<GPUJobData | null> {
  const { utilValues } = await queryDirectUtilValues(`hpc_job="${jobId}"`);
  if (utilValues.length === 0) return null;

  const avgUtilization = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;

  const memoryPct = await queryDirectMemory(`hpc_job="${jobId}"`).catch(() => 0);

  return {
    jobId,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    memoryPct: Math.round(memoryPct * 10) / 10,
    gpuCount: utilValues.length,
    isUnderutilized: avgUtilization < 30,
    source: "prometheus",
  };
}

async function queryJobFromDatabase(jobId: string): Promise<GPUJobData | null> {
  if (!jobMetricsPluginMetadata.isEnabled) return null;

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
    console.error(`Error querying GPU metrics from database for job ${jobId}:`, error);
    return null;
  }
}

// ─── GET: Cluster Overview (Database-backed) ────────────────────────────────

async function handleOverview(from?: string, to?: string): Promise<NextResponse> {
  if (!jobMetricsPluginMetadata.isEnabled) {
    return NextResponse.json({ status: 404, message: "Job Metrics plugin is not enabled" });
  }

  const pool = getMetricsDb();
  if (!pool) {
    return NextResponse.json({ status: 404, message: "Metrics database is not configured" });
  }

  try {
    const conditions: string[] = [];
    const params: any[] = [];
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
    console.error("Error querying GPU overview from database:", error);
    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU overview metrics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── POST: Capture GPU Metrics ───────────────────────────────────────────────

const extractCaptureJobMetrics = (utilResult: any, memUsedResult: any, memFreeResult: any): Map<string, GPUJobMetric> => {
  const jobMetrics = new Map<string, GPUJobMetric>();

  if (!utilResult?.result || !Array.isArray(utilResult.result)) {
    return jobMetrics;
  }

  const memUsedByGpu = new Map<string, number>();
  const memTotalByGpu = new Map<string, number>();

  if (memUsedResult?.result && memFreeResult?.result) {
    for (const item of memUsedResult.result) {
      const labels = item.metric?.labels || item.metric || {};
      const gpuKey = `${labels.Hostname || labels.instance}-${labels.gpu || labels.GPU_I_ID}`;
      const used = extractNumericValue(item.value);
      if (!isNaN(used)) memUsedByGpu.set(gpuKey, used);
    }
    for (const item of memFreeResult.result) {
      const labels = item.metric?.labels || item.metric || {};
      const gpuKey = `${labels.Hostname || labels.instance}-${labels.gpu || labels.GPU_I_ID}`;
      const free = extractNumericValue(item.value);
      const used = memUsedByGpu.get(gpuKey) || 0;
      if (!isNaN(free)) memTotalByGpu.set(gpuKey, used + free);
    }
  }

  for (const item of utilResult.result) {
    const labels = item.metric?.labels || item.metric || {};
    const jobId = labels.hpc_job;

    if (!jobId || jobId === "0" || jobId === "") continue;

    const utilValue = extractNumericValue(item.value);
    if (isNaN(utilValue)) continue;

    const gpuKey = `${labels.Hostname || labels.instance}-${labels.gpu || labels.GPU_I_ID}`;
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
    }
  }

  return jobMetrics;
};

async function handleCapture(): Promise<NextResponse<CaptureResult>> {
  if (!jobMetricsPluginMetadata.isEnabled) {
    return NextResponse.json({
      status: 400,
      message: "Job Metrics plugin is not enabled. GPU metrics capture requires the metrics database.",
    });
  }

  if (!gpuUtilizationPluginMetadata.isEnabled) {
    return NextResponse.json({
      status: 400,
      message: "GPU Utilization plugin is not enabled.",
    });
  }

  const pool = getMetricsDb();
  if (!pool) {
    return NextResponse.json({
      status: 500,
      message: "Metrics database is not configured (SLURM_JOB_METRICS_DATABASE_URL not set).",
    });
  }

  if (!prom) {
    return NextResponse.json({
      status: 500,
      message: "Prometheus is not configured (PROMETHEUS_URL not set).",
    });
  }

  try {
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
      });
    }
  } catch (err) {
    console.warn("Rate limit check failed, proceeding with capture:", err);
  }

  const errors: string[] = [];
  let captured = 0;
  let updated = 0;
  let markedComplete = 0;

  try {
    const [utilResult, memUsedResult, memFreeResult] = await Promise.all([
      prom.instantQuery('DCGM_FI_DEV_GPU_UTIL{hpc_job!="0", hpc_job!=""}').catch((e) => {
        errors.push(`Utilization query failed: ${e.message}`);
        return null;
      }),
      prom.instantQuery('DCGM_FI_DEV_FB_USED{hpc_job!="0", hpc_job!=""}').catch((e) => {
        errors.push(`Memory used query failed: ${e.message}`);
        return null;
      }),
      prom.instantQuery('DCGM_FI_DEV_FB_FREE{hpc_job!="0", hpc_job!=""}').catch((e) => {
        errors.push(`Memory free query failed: ${e.message}`);
        return null;
      }),
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
      } catch (err: any) {
        errors.push(`Failed to upsert job ${jobId}: ${err.message}`);
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
    } catch (err: any) {
      errors.push(`Failed to mark complete jobs: ${err.message}`);
    }

    return NextResponse.json({
      status: 200,
      message: "GPU metrics capture complete",
      captured,
      updated,
      markedComplete,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("GPU metrics capture error:", error);
    return NextResponse.json({
      status: 500,
      message: "Error capturing GPU metrics",
      errors: [...errors, error.message],
    });
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  try {
    if (jobId) {
      return await handleJobQuery(jobId);
    }
    return await handleOverview(from, to);
  } catch (error) {
    console.error("Error fetching GPU metrics:", error);

    // If querying a specific job, try database fallback
    if (jobId) {
      const dbData = await queryJobFromDatabase(jobId).catch(() => null);
      if (dbData) {
        return NextResponse.json({ status: 200, data: dbData });
      }
    }

    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU metrics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(): Promise<NextResponse<CaptureResult>> {
  return handleCapture();
}
