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
    console.log("No results found");
    return defaultValue;
  }

  try {
    const item = result.result[0];

    // Check if value is an array [timestamp, value] format
    if (Array.isArray(item.value)) {
      console.log("Value is array format:", item.value);
      return parseFloat(item.value[1]) || defaultValue;
    }

    // Check if value is nested object with time and value properties
    if (item.value && typeof item.value === "object" && "value" in item.value) {
      console.log("Value is object format:", item.value);
      return parseFloat(item.value.value) || defaultValue;
    }

    // Direct value access
    if (typeof item.value === "string" || typeof item.value === "number") {
      console.log("Value is direct format:", item.value);
      return parseFloat(item.value) || defaultValue;
    }

    console.log("Unexpected value format:", item.value);
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
  const jobFilter = searchParams.get("jobId") || "";

  try {
    // Get all underutilized jobs based on threshold
    let underutilizedQuery = "";

    if (jobFilter) {
      // If job filter is provided, check only that specific job
      // IMPORTANT: Using <= instead of < to include 0% utilization
      underutilizedQuery = `job:gpu_utilization:current_avg{hpc_job=~".*${jobFilter}.*"} <= ${threshold}`;
    } else {
      // Otherwise get all jobs below threshold
      // IMPORTANT: Using <= instead of < to include 0% utilization
      underutilizedQuery = `job:gpu_utilization:current_avg <= ${threshold}`;
    }

    console.log("Using query:", underutilizedQuery);
    const underutilizedResult = await prom.instantQuery(underutilizedQuery);
    console.log(`Found ${underutilizedResult.result.length} total results`);

    // Debug the first result to examine structure
    if (underutilizedResult.result.length > 0) {
      console.log(
        "First result structure:",
        JSON.stringify(underutilizedResult.result[0], null, 2)
      );
    }

    // Extract job IDs from the result
    const jobIds = underutilizedResult.result
      .map((item) => {
        const jobId = item.metric?.hpc_job || item.metric?.labels?.hpc_job;
        if (!jobId) {
          console.log(
            "No hpc_job found in metric:",
            JSON.stringify(item.metric, null, 2)
          );
        }
        return jobId;
      })
      .filter(Boolean)
      .slice(0, limit);

    console.log("Extracted job IDs:", jobIds);

    if (jobIds.length === 0) {
      console.log("No underutilized jobs found after filtering");

      // Let's try to get ALL jobs to see if any exist
      try {
        const allJobsQuery = "job:gpu_utilization:current_avg";
        const allJobsResult = await prom.instantQuery(allJobsQuery);
        console.log(
          `Found ${allJobsResult.result.length} total jobs in Prometheus`
        );

        if (allJobsResult.result.length > 0) {
          console.log(
            "Sample job metrics:",
            JSON.stringify(allJobsResult.result[0], null, 2)
          );
        }
      } catch (error) {
        console.error("Error checking all jobs:", error);
      }

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
    console.log("Querying job metrics with selector:", jobsSelector);

    const [gpuUtilResults, memUtilResults, memMaxResults, gpuCountResults] =
      await Promise.all([
        prom.instantQuery(`job:gpu_utilization:current_avg${jobsSelector}`),
        prom.instantQuery(`job:gpu_memory:current_avg_pct${jobsSelector}`),
        prom.instantQuery(`job:gpu_memory:current_max_pct${jobsSelector}`),
        prom.instantQuery(`job:gpu_count:current${jobsSelector}`),
      ]);

    // Debug first result from each query to understand structure
    if (gpuUtilResults.result.length > 0) {
      console.log(
        "GPU Util sample:",
        JSON.stringify(gpuUtilResults.result[0], null, 2)
      );
    }

    // Create a map of job metrics for easy lookup
    const metricsMap: Record<string, any> = {};

    // Process all metric results with the fixed extraction function
    [
      { results: gpuUtilResults, key: "gpuUtilization" },
      { results: memUtilResults, key: "memoryUtilization" },
      { results: memMaxResults, key: "maxMemoryUtilization" },
      { results: gpuCountResults, key: "gpuCount" },
    ].forEach(({ results, key }) => {
      results.result.forEach((item) => {
        // Handle different possible structures of the metric
        const jobId = item.metric?.hpc_job || item.metric?.labels?.hpc_job;
        if (!jobId) {
          console.log(`No jobId found for ${key} metric:`, item);
          return;
        }

        if (!metricsMap[jobId]) {
          metricsMap[jobId] = {};
        }

        // Extract value safely using our helper function
        // This handles both array format [timestamp, value] and object format {time, value}
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
            console.log(`Invalid ${key} value for job ${jobId}:`, item.value);
            value = 0;
          }
        } catch (error) {
          console.error(`Error parsing ${key} value for job ${jobId}:`, error);
          value = 0;
        }

        metricsMap[jobId][key] = value;
        console.log(`Set ${key} for job ${jobId} to ${value}`);
      });
    });

    console.log("Metrics map:", metricsMap);

    // Build the job details array
    const jobDetails = jobIds.map((jobId) => {
      const metrics = metricsMap[jobId] || {};
      console.log(`Building details for job ${jobId}:`, metrics);

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

    console.log("Final job details:", jobDetails);

    // Count total underutilized jobs
    const totalQuery = `count(${underutilizedQuery})`;
    const totalResult = await prom.instantQuery(totalQuery);
    const totalCount = parseInt(
      Array.isArray(totalResult.result[0]?.value)
        ? totalResult.result[0]?.value[1]
        : totalResult.result[0]?.value?.value || "0"
    );

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
