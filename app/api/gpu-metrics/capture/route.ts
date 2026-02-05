export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { getMetricsDb } from "@/lib/metrics-db";
import { jobMetricsPluginMetadata, gpuUtilizationPluginMetadata } from "@/actions/plugins";

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

const RATE_LIMIT_SECONDS = 60;

interface GPUJobMetric {
  jobId: string;
  avgUtilization: number;
  maxUtilization: number;
  minUtilization: number;
  avgMemoryPct: number;
  maxMemoryPct: number;
  gpuCount: number;
}

const extractJobMetrics = (utilResult: any, memUsedResult: any, memFreeResult: any): Map<string, GPUJobMetric> => {
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
      const used = Array.isArray(item.value) ? parseFloat(item.value[1]) : parseFloat(item.value);
      if (!isNaN(used)) memUsedByGpu.set(gpuKey, used);
    }
    for (const item of memFreeResult.result) {
      const labels = item.metric?.labels || item.metric || {};
      const gpuKey = `${labels.Hostname || labels.instance}-${labels.gpu || labels.GPU_I_ID}`;
      const free = Array.isArray(item.value) ? parseFloat(item.value[1]) : parseFloat(item.value);
      const used = memUsedByGpu.get(gpuKey) || 0;
      if (!isNaN(free)) memTotalByGpu.set(gpuKey, used + free);
    }
  }

  for (const item of utilResult.result) {
    const labels = item.metric?.labels || item.metric || {};
    const jobId = labels.hpc_job;

    if (!jobId || jobId === "0" || jobId === "") continue;

    const utilValue = Array.isArray(item.value) ? parseFloat(item.value[1]) : parseFloat(item.value);
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

export async function GET(): Promise<NextResponse<CaptureResult>> {
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

    const jobMetrics = extractJobMetrics(utilResult, memUsedResult, memFreeResult);
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
      message: `GPU metrics capture complete`,
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

export async function POST(): Promise<NextResponse<CaptureResult>> {
  return GET();
}
