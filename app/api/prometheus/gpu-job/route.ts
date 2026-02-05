export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { getMetricsDb } from "@/lib/metrics-db";
import { jobMetricsPluginMetadata } from "@/actions/plugins";

interface GPUJobResponse {
  status: number;
  data?: {
    jobId: string;
    avgUtilization: number;
    p95Utilization: number;
    memoryPct: number;
    gpuCount: number;
    isUnderutilized: boolean;
    source?: "prometheus" | "database";
    isComplete?: boolean;
  };
  message?: string;
  error?: string;
}

const extractValue = (result: any): number | null => {
  try {
    if (!result?.result || !result.result[0]) return null;
    const item = result.result[0];
    if (item.value) {
      if (Array.isArray(item.value) && item.value.length > 1) {
        return parseFloat(item.value[1]);
      }
      if (typeof item.value === "object" && item.value.value !== undefined) {
        return parseFloat(item.value.value);
      }
      return parseFloat(item.value);
    }
    return null;
  } catch {
    return null;
  }
};

const checkRecordingRulesAvailable = async (jobId: string): Promise<boolean> => {
  if (!prom) return false;
  try {
    const result = await prom.instantQuery(`job:gpu_utilization:current_avg{hpc_job="${jobId}"}`);
    return result && Array.isArray(result.result) && result.result.length > 0;
  } catch {
    return false;
  }
};

const queryWithRecordingRules = async (jobId: string): Promise<GPUJobResponse["data"]> => {
  if (!prom) throw new Error("Prometheus not configured");

  const [avgResult, p95Result, memResult, countResult, underutilResult] = await Promise.all([
    prom.instantQuery(`job:gpu_utilization:current_avg{hpc_job="${jobId}"}`).catch(() => null),
    prom.instantQuery(`job:gpu_utilization:current_p95{hpc_job="${jobId}"}`).catch(() => null),
    prom.instantQuery(`job:gpu_memory:current_avg_pct{hpc_job="${jobId}"}`).catch(() => null),
    prom.instantQuery(`job:gpu_count:current{hpc_job="${jobId}"}`).catch(() => null),
    prom.instantQuery(`job:gpu_underutilized:bool{hpc_job="${jobId}"}`).catch(() => null),
  ]);

  const avgUtilization = extractValue(avgResult) ?? 0;

  return {
    jobId,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    p95Utilization: Math.round((extractValue(p95Result) ?? avgUtilization) * 10) / 10,
    memoryPct: Math.round((extractValue(memResult) ?? 0) * 10) / 10,
    gpuCount: extractValue(countResult) ?? 1,
    isUnderutilized: extractValue(underutilResult) === 1 || avgUtilization < 30,
    source: "prometheus",
  };
};

const queryWithDirectMetrics = async (jobId: string): Promise<GPUJobResponse["data"] | null> => {
  if (!prom) throw new Error("Prometheus not configured");

  const utilResult = await prom.instantQuery(`DCGM_FI_DEV_GPU_UTIL{hpc_job="${jobId}"}`);

  if (!utilResult?.result || !Array.isArray(utilResult.result) || utilResult.result.length === 0) {
    return null;
  }

  const utilValues: number[] = [];
  for (const item of utilResult.result) {
    const val = Array.isArray(item.value) ? parseFloat(item.value[1]) : parseFloat(item.value);
    if (!isNaN(val)) utilValues.push(val);
  }

  if (utilValues.length === 0) return null;

  const avgUtilization = utilValues.reduce((a, b) => a + b, 0) / utilValues.length;
  const sortedUtils = [...utilValues].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedUtils.length * 0.95);
  const p95Utilization = sortedUtils[Math.min(p95Index, sortedUtils.length - 1)];

  let memoryPct = 0;
  try {
    const memUsedResult = await prom.instantQuery(`DCGM_FI_DEV_FB_USED{hpc_job="${jobId}"}`);
    const memFreeResult = await prom.instantQuery(`DCGM_FI_DEV_FB_FREE{hpc_job="${jobId}"}`);

    if (memUsedResult?.result && memFreeResult?.result) {
      let totalUsed = 0;
      let totalMem = 0;
      for (let i = 0; i < memUsedResult.result.length; i++) {
        const used = Array.isArray(memUsedResult.result[i]?.value)
          ? parseFloat(memUsedResult.result[i].value[1])
          : 0;
        const free = memFreeResult.result[i]?.value
          ? (Array.isArray(memFreeResult.result[i].value)
            ? parseFloat(memFreeResult.result[i].value[1])
            : 0)
          : 0;
        if (!isNaN(used) && !isNaN(free)) {
          totalUsed += used;
          totalMem += used + free;
        }
      }
      memoryPct = totalMem > 0 ? (totalUsed / totalMem) * 100 : 0;
    }
  } catch {
    memoryPct = 0;
  }

  return {
    jobId,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    p95Utilization: Math.round(p95Utilization * 10) / 10,
    memoryPct: Math.round(memoryPct * 10) / 10,
    gpuCount: utilValues.length,
    isUnderutilized: avgUtilization < 30,
    source: "prometheus",
  };
};

const queryFromDatabase = async (jobId: string): Promise<GPUJobResponse["data"] | null> => {
  if (!jobMetricsPluginMetadata.isEnabled) return null;

  const pool = getMetricsDb();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT 
        job_id,
        avg_utilization,
        max_utilization,
        avg_memory_pct,
        gpu_count,
        is_complete,
        sample_count
       FROM job_gpu_metrics
       WHERE job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const avgUtilization = parseFloat(row.avg_utilization);

    return {
      jobId: row.job_id,
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      p95Utilization: Math.round(parseFloat(row.max_utilization) * 10) / 10,
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
};

export async function GET(req: Request): Promise<NextResponse<GPUJobResponse>> {
  const jobId = new URL(req.url).searchParams.get("job_id");
  if (!jobId) {
    return NextResponse.json({
      status: 400,
      message: "Missing required 'job_id' parameter",
    });
  }

  try {
    if (prom) {
      const hasRecordingRules = await checkRecordingRulesAvailable(jobId);

      if (hasRecordingRules) {
        const data = await queryWithRecordingRules(jobId);
        return NextResponse.json({ status: 200, data });
      }

      const data = await queryWithDirectMetrics(jobId);
      if (data) {
        return NextResponse.json({ status: 200, data });
      }
    }

    const dbData = await queryFromDatabase(jobId);
    if (dbData) {
      return NextResponse.json({ status: 200, data: dbData });
    }

    return NextResponse.json({
      status: 404,
      message: `No GPU metrics found for job ${jobId}`,
    });
  } catch (error) {
    console.error(`Error fetching GPU metrics for job ${jobId}:`, error);

    const dbData = await queryFromDatabase(jobId).catch(() => null);
    if (dbData) {
      return NextResponse.json({ status: 200, data: dbData });
    }

    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU metrics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
