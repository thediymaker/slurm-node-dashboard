// app/api/prometheus/job-metrics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;
let prom: PrometheusDriver | null = null;
if (PROMETHEUS_URL) {
  prom = new PrometheusDriver({
    endpoint: PROMETHEUS_URL,
    baseURL: "/api/v1",
  });
}

/**
 * Standardizes a range query result so that each data point is an array:
 * [timestamp, "value"] (timestamp in epoch seconds).
 */
function standardizeRangeQueryResult(queryResult: any): any {
  if (!queryResult || !queryResult.result) return queryResult;
  const newResult = queryResult.result.map((res: any) => {
    let newValues = res.values;
    if (newValues && newValues.length > 0) {
      if (typeof newValues[0] === "object" && !Array.isArray(newValues[0])) {
        newValues = newValues.map((pt: any) => {
          const ts = new Date(pt.time).getTime() / 1000;
          return [ts, String(pt.value)];
        });
      }
    } else if (res.value && res.value.time && res.value.value != null) {
      const ts = new Date(res.value.time).getTime() / 1000;
      newValues = [[ts, String(res.value.value)]];
    }
    return { ...res, values: newValues };
  });
  return { ...queryResult, result: newResult };
}

/**
 * Standardizes an instant query result's value into an array [timestamp, "value"].
 */
function standardizeInstantQueryValue(item: any): [number, string] {
  if (item.value) {
    if (Array.isArray(item.value)) {
      if (item.value[0] == null || item.value[1] == null) {
        return [0, "0"];
      }
      return item.value;
    }
    if (
      typeof item.value === "object" &&
      item.value.time &&
      item.value.value != null
    ) {
      const ts = new Date(item.value.time).getTime() / 1000;
      return [ts, String(item.value.value)];
    }
  }
  return [0, "0"];
}

/**
 * Safely parses a string into a number.
 */
function safeParse(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Computes the average of a trend array.
 */
function averageTrend(trend: any[]): number {
  if (!trend || trend.length === 0) return 0;
  const total = trend.reduce((acc, pt) => acc + safeParse(pt[1]), 0);
  return total / trend.length;
}

/**
 * Extracts a numeric value from an instant query result by taking the last point.
 */
function extractMetricValue(result: any): number {
  if (result && result.result && result.result.length > 0) {
    const firstRes = result.result[0];
    if (firstRes.values && firstRes.values.length > 0) {
      const lastPoint = firstRes.values[firstRes.values.length - 1];
      return safeParse(lastPoint[1]);
    }
    const instVal = standardizeInstantQueryValue(firstRes);
    return safeParse(instVal[1]);
  }
  return 0;
}

/**
 * Main API endpoint for completed jobs.
 * Uses range vector queries (e.g. [1d]) for trend data.
 */
export async function GET(req: NextRequest) {
  if (!prom) {
    return NextResponse.json({
      status: 404,
      message: "Prometheus connection not configured",
    });
  }
  const searchParams = req.nextUrl.searchParams;
  // Expect period to be "1d", "7d", or "30d"
  const period = searchParams.get("period") || "1d";
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({
      status: 400,
      error: "jobId parameter is required",
    });
  }

  try {
    // --- GPU Utilization Trend ---
    const gpuQuery = `job:gpu_utilization:current_avg{hpc_job="${jobId}"}[${period}]`;
    const gpuTrendRaw = await prom.instantQuery(gpuQuery);
    const standardizedGpuTrend = standardizeRangeQueryResult(gpuTrendRaw);
    const gpuTrend =
      (standardizedGpuTrend.result && standardizedGpuTrend.result[0]?.values) ||
      [];

    // --- Memory Utilization Trend ---
    // First, try the recording rule.
    let memQuery = `job:gpu_memory:current_avg_pct{hpc_job="${jobId}"}[${period}]`;
    let memTrendRaw = await prom.instantQuery(memQuery);
    let standardizedMemTrend = standardizeRangeQueryResult(memTrendRaw);
    let memTrend =
      (standardizedMemTrend.result && standardizedMemTrend.result[0]?.values) ||
      [];
    // Fallback: if no memory trend data or value is zero, try a direct ratio query.
    if (
      memTrend.length === 0 ||
      safeParse(memTrend[memTrend.length - 1][1]) === 0
    ) {
      const fallbackMemQuery = `DCGM_FI_DEV_FB_USED{hpc_job="${jobId}"} / (DCGM_FI_DEV_FB_USED{hpc_job="${jobId}"} + DCGM_FI_DEV_FB_FREE{hpc_job="${jobId}"}) * 100`;
      const fallbackMemRaw = await prom.instantQuery(fallbackMemQuery);
      standardizedMemTrend = standardizeRangeQueryResult(fallbackMemRaw);
      memTrend =
        (standardizedMemTrend.result &&
          standardizedMemTrend.result[0]?.values) ||
        [];
    }

    // --- Determine Job Metadata ---
    let startTime: Date | null = null;
    if (gpuTrend.length > 0) {
      startTime = new Date(gpuTrend[0][0] * 1000);
    }
    const now = new Date();
    const duration = startTime ? now.getTime() - startTime.getTime() : 0;

    // --- Current Metrics ---
    // For GPU utilization and P95, use range vector queries.
    const gpuUtilInstant = await prom.instantQuery(
      `job:gpu_utilization:current_avg{hpc_job="${jobId}"}[${period}]`
    );
    const gpuUtilP95Instant = await prom.instantQuery(
      `job:gpu_utilization:current_p95{hpc_job="${jobId}"}[${period}]`
    );
    // For memory utilization and GPU count, use instant queries without the range vector.
    const gpuMemInstant = await prom.instantQuery(
      `job:gpu_memory:current_avg_pct{hpc_job="${jobId}"}`
    );
    const gpuMemMaxInstant = await prom.instantQuery(
      `job:gpu_memory:current_max_pct{hpc_job="${jobId}"}`
    );
    const gpuCountInstant = await prom.instantQuery(
      `job:gpu_count:current{hpc_job="${jobId}"}`
    );

    const rawCurrentMetrics = {
      gpu_util: extractMetricValue(gpuUtilInstant),
      gpu_util_p95: extractMetricValue(gpuUtilP95Instant),
      gpu_mem: extractMetricValue(gpuMemInstant),
      gpu_mem_max: extractMetricValue(gpuMemMaxInstant),
      gpu_count: extractMetricValue(gpuCountInstant),
    };

    // Fallback for GPU utilization if needed.
    const lastGpuUtil =
      gpuTrend.length > 0 ? safeParse(gpuTrend[gpuTrend.length - 1][1]) : NaN;
    const avgGpuTrend = averageTrend(gpuTrend);
    const computedGpuUtil =
      isNaN(lastGpuUtil) || lastGpuUtil === 0 ? avgGpuTrend : lastGpuUtil;

    const safeValue = (n: number, fallback: number) =>
      isNaN(n) || n === 0 ? fallback : n;
    let currentMetricsValues = {
      gpu_util: safeValue(rawCurrentMetrics.gpu_util, computedGpuUtil),
      gpu_util_p95: safeValue(rawCurrentMetrics.gpu_util_p95, computedGpuUtil),
      gpu_mem: safeValue(rawCurrentMetrics.gpu_mem, 0),
      gpu_mem_max: safeValue(rawCurrentMetrics.gpu_mem_max, 0),
      gpu_count: safeValue(rawCurrentMetrics.gpu_count, 0),
    };

    // Fallback for memory current metric: if still zero, try the ratio query.
    if (currentMetricsValues.gpu_mem === 0) {
      const fallbackMemRaw = await prom.instantQuery(
        `DCGM_FI_DEV_FB_USED{hpc_job="${jobId}"} / (DCGM_FI_DEV_FB_USED{hpc_job="${jobId}"} + DCGM_FI_DEV_FB_FREE{hpc_job="${jobId}"}) * 100`
      );
      const fallbackMemVal = extractMetricValue(fallbackMemRaw);
      currentMetricsValues.gpu_mem = safeValue(fallbackMemVal, 0);
    }

    // Use the last timestamp from the GPU trend for current metrics.
    const lastTimestamp =
      gpuTrend.length > 0 ? gpuTrend[gpuTrend.length - 1][0] : 0;
    const currentMetricsArray = [
      {
        metric: { gpu_util: true },
        value: [lastTimestamp, String(currentMetricsValues.gpu_util)],
      },
      {
        metric: { gpu_util_p95: true },
        value: [lastTimestamp, String(currentMetricsValues.gpu_util_p95)],
      },
      {
        metric: { gpu_mem: true },
        value: [lastTimestamp, String(currentMetricsValues.gpu_mem)],
      },
      {
        metric: { gpu_mem_max: true },
        value: [lastTimestamp, String(currentMetricsValues.gpu_mem_max)],
      },
      {
        metric: { gpu_count: true },
        value: [lastTimestamp, String(currentMetricsValues.gpu_count)],
      },
    ];

    // --- Assemble the Response ---
    const responseData = {
      jobId,
      startTime: startTime ? startTime.toISOString() : null,
      duration,
      gpuCount: currentMetricsValues.gpu_count,
      gpuUtilization: {
        result: [
          {
            metric: {
              name: "job:gpu_utilization:current_avg",
              labels: {
                hpc_job: jobId,
                start_time: startTime
                  ? Math.floor(startTime.getTime() / 1000).toString()
                  : null,
              },
            },
            values: gpuTrend,
          },
        ],
        avg: currentMetricsValues.gpu_util,
        max:
          gpuTrend.length > 0
            ? Math.max(...gpuTrend.map((pt: any) => safeParse(pt[1])))
            : 0,
        p95: currentMetricsValues.gpu_util_p95,
      },
      memoryUtilization: {
        result: [
          {
            metric: {
              name: "job:gpu_memory:current_avg_pct",
              labels: { hpc_job: jobId },
            },
            values: memTrend,
          },
        ],
        avg: currentMetricsValues.gpu_mem,
        max:
          memTrend.length > 0
            ? Math.max(...memTrend.map((pt: any) => safeParse(pt[1])))
            : 0,
      },
      currentMetrics: { result: currentMetricsArray },
      period,
    };

    return NextResponse.json({ status: 200, data: responseData });
  } catch (error) {
    console.error("Error fetching Prometheus metrics:", error);
    return NextResponse.json(
      { status: 500, error: "Failed to fetch metrics", details: error },
      { status: 500 }
    );
  }
}
