// app/api/prometheus/job-metrics/underutilized/route.ts

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

export async function GET(req: NextRequest) {
  if (!prom) {
    console.error(
      "Prometheus client not initialized. PROMETHEUS_URL:",
      PROMETHEUS_URL
    );
    return NextResponse.json({
      status: 404,
      message: "Prometheus connection not configured",
      debug: { prometheusUrl: PROMETHEUS_URL },
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const threshold = parseFloat(searchParams.get("threshold") || "30");
  const limit = parseInt(searchParams.get("limit") || "50");
  const jobFilter = searchParams.get("jobId") || "";

  try {
    // Get all underutilized jobs based on threshold
    let underutilizedQuery = "";

    if (jobFilter) {
      // If job filter is provided, check only that specific job
      underutilizedQuery = `job:gpu_utilization:current_avg{hpc_job=~".*${jobFilter}.*"} < ${threshold}`;
    } else {
      // Otherwise get all jobs below threshold
      underutilizedQuery = `job:gpu_utilization:current_avg < ${threshold}`;
    }

    const underutilizedResult = await prom.instantQuery(underutilizedQuery);

    // Extract job IDs from the result
    const jobIds = underutilizedResult.result
      .map((item) => item.metric.hpc_job)
      .filter(Boolean)
      .slice(0, limit);

    if (jobIds.length === 0) {
      return NextResponse.json({
        status: 200,
        data: {
          jobs: [],
          total: 0,
        },
      });
    }

    // Create a vector selector with all job IDs for batch querying
    const jobsSelector = `{hpc_job=~"${jobIds.join("|")}"}`;

    // Batch query all metrics for these jobs
    const [gpuUtilResults, memUtilResults, memMaxResults, gpuCountResults] =
      await Promise.all([
        prom.instantQuery(`job:gpu_utilization:current_avg${jobsSelector}`),
        prom.instantQuery(`job:gpu_memory:current_avg_pct${jobsSelector}`),
        prom.instantQuery(`job:gpu_memory:current_max_pct${jobsSelector}`),
        prom.instantQuery(`job:gpu_count:current${jobsSelector}`),
      ]);

    // Create a map of job metrics for easy lookup
    const metricsMap: Record<string, any> = {};

    // Process all metric results
    [
      { result: gpuUtilResults.result, key: "gpuUtilization" },
      { result: memUtilResults.result, key: "memoryUtilization" },
      { result: memMaxResults.result, key: "maxMemoryUtilization" },
      { result: gpuCountResults.result, key: "gpuCount" },
    ].forEach(({ result, key }) => {
      result.forEach((item) => {
        const jobId = item.metric.hpc_job;
        if (!metricsMap[jobId]) {
          metricsMap[jobId] = {};
        }
        metricsMap[jobId][key] = parseFloat(item.value[1]);
      });
    });

    // Build the job details array
    const jobDetails = jobIds.map((jobId) => {
      const metrics = metricsMap[jobId] || {};

      // Use a deterministic "random" start time based on jobId hash
      // In production, you would want to get this from Prometheus or your job system
      const jobIdHash = jobId
        .split("")
        .reduce((acc: any, char: string) => acc + char.charCodeAt(0), 0);
      const startTimeOffset = (jobIdHash % 72) * 3600000; // Up to 72 hours ago
      const startTime = Date.now() - startTimeOffset;

      return {
        jobId,
        gpuUtilization: metrics.gpuUtilization || 0,
        memoryUtilization: metrics.memoryUtilization || 0,
        maxMemoryUtilization: metrics.maxMemoryUtilization || 0,
        gpuCount: Math.round(metrics.gpuCount || 1),
        startTime,
      };
    });

    // Count total underutilized jobs
    const totalQuery = `count(${underutilizedQuery})`;
    const totalResult = await prom.instantQuery(totalQuery);
    const totalCount = parseInt(totalResult.result[0]?.value[1] || "0");

    return NextResponse.json({
      status: 200,
      data: {
        jobs: jobDetails,
        total: totalCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching underutilized jobs:", error);
    return NextResponse.json(
      {
        status: 500,
        error: "Failed to fetch underutilized jobs",
        details: error.message || error,
      },
      { status: 500 }
    );
  }
}
