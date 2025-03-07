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

// Helper function to safely extract numeric values from Prometheus results
function extractValueFromPrometheusResult(
  result: any,
  defaultValue: number = 0
): number {
  if (!result || !result.result || result.result.length === 0) {
    return defaultValue;
  }

  try {
    const item = result.result[0];

    // Check if value is an array [timestamp, value] format
    if (Array.isArray(item.value)) {
      return parseFloat(item.value[1]) || defaultValue;
    }

    // Check if value is nested object with time and value properties
    if (item.value && typeof item.value === "object" && "value" in item.value) {
      return parseFloat(item.value.value) || defaultValue;
    }

    // Direct value access
    if (typeof item.value === "string" || typeof item.value === "number") {
      return parseFloat(String(item.value)) || defaultValue;
    }

    return defaultValue;
  } catch (error) {
    console.error("Error extracting value:", error);
    return defaultValue;
  }
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
  const offset = parseInt(searchParams.get("offset") || "0"); // Add offset parameter
  const jobFilter = searchParams.get("jobId") || "";

  console.log(
    `Processing request with: threshold=${threshold}, limit=${limit}, offset=${offset}, jobFilter=${jobFilter}`
  );

  try {
    // Get all underutilized jobs based on threshold
    let underutilizedQuery = "";

    if (jobFilter) {
      // If job filter is provided, check only that specific job
      underutilizedQuery = `job:gpu_utilization:current_avg{hpc_job=~".*${jobFilter}.*"} <= ${threshold}`;
    } else {
      // Otherwise get all jobs below threshold
      underutilizedQuery = `job:gpu_utilization:current_avg <= ${threshold}`;
    }

    console.log("Using query:", underutilizedQuery);
    const underutilizedResult = await prom.instantQuery(underutilizedQuery);
    console.log(`Found ${underutilizedResult.result.length} total results`);

    // Extract job IDs from the result
    const allJobIds = underutilizedResult.result
      .map((item) => {
        const jobId = item.metric?.hpc_job || item.metric?.labels?.hpc_job;
        return jobId;
      })
      .filter(Boolean);

    // Calculate total count for pagination
    const totalCount = allJobIds.length;

    // Apply pagination to job IDs - IMPORTANT FIX for pagination
    const jobIds = allJobIds.slice(offset, offset + limit);

    console.log(
      `Total jobs: ${totalCount}, returning page with ${jobIds.length} jobs starting from offset ${offset}`
    );

    if (jobIds.length === 0) {
      console.log("No underutilized jobs found for current page");
      return NextResponse.json({
        status: 200,
        data: {
          jobs: [],
          total: totalCount, // Return total for pagination controls
        },
      });
    }

    // Create a vector selector with all job IDs for batch querying
    const jobsSelector = `{hpc_job=~"${jobIds.join("|")}"}`;

    // Batch query all metrics for these jobs
    console.log("Querying job metrics with selector:", jobsSelector);

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
        // Handle different possible structures of the metric
        const jobId = item.metric?.hpc_job || item.metric?.labels?.hpc_job;
        if (!jobId) {
          return;
        }

        if (!metricsMap[jobId]) {
          metricsMap[jobId] = {};
        }

        // Extract value safely handling both array and object formats
        let value: number;

        try {
          if (Array.isArray(item.value)) {
            // Standard Prometheus format [timestamp, value]
            value = parseFloat(item.value[1]);
          } else if (
            item.value &&
            typeof item.value === "object" &&
            "value" in item.value
          ) {
            // Object format with nested value
            value = parseFloat(item.value.value);
          } else {
            // Direct value (unlikely but handle it)
            value = parseFloat(String(item.value));
          }

          if (isNaN(value)) {
            value = 0;
          }
        } catch (error) {
          value = 0;
        }

        metricsMap[jobId][key] = value;
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
        gpuUtilization:
          typeof metrics.gpuUtilization === "number"
            ? metrics.gpuUtilization
            : 0,
        memoryUtilization:
          typeof metrics.memoryUtilization === "number"
            ? metrics.memoryUtilization
            : 0,
        maxMemoryUtilization:
          typeof metrics.maxMemoryUtilization === "number"
            ? metrics.maxMemoryUtilization
            : 0,
        gpuCount:
          typeof metrics.gpuCount === "number"
            ? Math.round(metrics.gpuCount)
            : 1,
        startTime,
      };
    });

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
