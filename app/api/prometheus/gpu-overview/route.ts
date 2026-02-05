export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";

interface GPUOverviewResponse {
  status: number;
  data?: {
    avgUtilization: number;
    p95Utilization: number;
    memoryUtilization: number;
    totalGPUs: number;
    activeJobs: number;
    underutilizedJobs: number;
  };
  message?: string;
  error?: string;
  source?: "recording_rules" | "direct_query";
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

const extractCount = (result: any): number => {
  try {
    if (!result?.result || !Array.isArray(result.result)) return 0;
    return result.result.length;
  } catch {
    return 0;
  }
};

const checkRecordingRulesAvailable = async (): Promise<boolean> => {
  if (!prom) return false;
  try {
    const result = await prom.instantQuery("job:gpu_utilization:current_avg");
    return result && Array.isArray(result.result) && result.result.length > 0;
  } catch {
    return false;
  }
};

const queryWithRecordingRules = async (): Promise<GPUOverviewResponse["data"]> => {
  if (!prom) throw new Error("Prometheus not configured");

  const queries = {
    avgUtilization: "avg(job:gpu_utilization:current_avg)",
    p95Utilization: "quantile(0.95, job:gpu_utilization:current_avg)",
    memoryUtilization: "avg(job:gpu_memory:current_avg_pct)",
    totalGPUs: "sum(job:gpu_count:current)",
    activeJobs: "count(job:gpu_utilization:current_avg)",
    underutilizedJobs: "count(job:gpu_underutilized:bool == 1)",
  };

  const results = await Promise.all([
    prom.instantQuery(queries.avgUtilization).catch(() => null),
    prom.instantQuery(queries.p95Utilization).catch(() => null),
    prom.instantQuery(queries.memoryUtilization).catch(() => null),
    prom.instantQuery(queries.totalGPUs).catch(() => null),
    prom.instantQuery(queries.activeJobs).catch(() => null),
    prom.instantQuery(queries.underutilizedJobs).catch(() => null),
  ]);

  return {
    avgUtilization: extractValue(results[0]) ?? 0,
    p95Utilization: extractValue(results[1]) ?? 0,
    memoryUtilization: extractValue(results[2]) ?? 0,
    totalGPUs: extractValue(results[3]) ?? 0,
    activeJobs: extractValue(results[4]) ?? 0,
    underutilizedJobs: extractValue(results[5]) ?? 0,
  };
};

const queryWithDirectMetrics = async (): Promise<GPUOverviewResponse["data"]> => {
  if (!prom) throw new Error("Prometheus not configured");

  const gpuUtilResult = await prom.instantQuery('DCGM_FI_DEV_GPU_UTIL{hpc_job!="0", hpc_job!=""}');
  const gpuMemUsedResult = await prom.instantQuery('DCGM_FI_DEV_FB_USED{hpc_job!="0", hpc_job!=""}');
  const gpuMemFreeResult = await prom.instantQuery('DCGM_FI_DEV_FB_FREE{hpc_job!="0", hpc_job!=""}');

  const utilValues: number[] = [];
  const jobSet = new Set<string>();
  let totalGPUs = 0;

  if (gpuUtilResult?.result && Array.isArray(gpuUtilResult.result)) {
    for (const item of gpuUtilResult.result) {
      const jobId = item.metric?.labels?.hpc_job || item.metric?.hpc_job;
      if (jobId && jobId !== "0" && jobId !== "") {
        jobSet.add(jobId);
        totalGPUs++;
        const val = Array.isArray(item.value) ? parseFloat(item.value[1]) : parseFloat(item.value);
        if (!isNaN(val)) utilValues.push(val);
      }
    }
  }

  const avgUtilization = utilValues.length > 0
    ? utilValues.reduce((a, b) => a + b, 0) / utilValues.length
    : 0;

  const sortedUtils = [...utilValues].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedUtils.length * 0.95);
  const p95Utilization = sortedUtils.length > 0 ? sortedUtils[Math.min(p95Index, sortedUtils.length - 1)] : 0;

  const underutilizedJobs = utilValues.filter(v => v < 30).length;

  let memoryUtilization = 0;
  if (gpuMemUsedResult?.result && gpuMemFreeResult?.result) {
    let totalUsed = 0;
    let totalMem = 0;
    for (let i = 0; i < gpuMemUsedResult.result.length; i++) {
      const used = Array.isArray(gpuMemUsedResult.result[i]?.value)
        ? parseFloat(gpuMemUsedResult.result[i].value[1])
        : 0;
      const free = gpuMemFreeResult.result[i]?.value
        ? (Array.isArray(gpuMemFreeResult.result[i].value)
          ? parseFloat(gpuMemFreeResult.result[i].value[1])
          : 0)
        : 0;
      if (!isNaN(used) && !isNaN(free)) {
        totalUsed += used;
        totalMem += used + free;
      }
    }
    memoryUtilization = totalMem > 0 ? (totalUsed / totalMem) * 100 : 0;
  }

  return {
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    p95Utilization: Math.round(p95Utilization * 10) / 10,
    memoryUtilization: Math.round(memoryUtilization * 10) / 10,
    totalGPUs,
    activeJobs: jobSet.size,
    underutilizedJobs,
  };
};

export async function GET(): Promise<NextResponse<GPUOverviewResponse>> {
  if (!prom) {
    return NextResponse.json({
      status: 404,
      message: "Prometheus not configured",
    });
  }

  try {
    const hasRecordingRules = await checkRecordingRulesAvailable();

    if (hasRecordingRules) {
      const data = await queryWithRecordingRules();
      return NextResponse.json({
        status: 200,
        data,
        source: "recording_rules",
      });
    }

    const data = await queryWithDirectMetrics();
    return NextResponse.json({
      status: 200,
      data,
      source: "direct_query",
    });
  } catch (error) {
    console.error("Error fetching GPU overview:", error);
    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU metrics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
