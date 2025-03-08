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

// Function to determine appropriate time window for averaging
function getTimeWindow(jobDuration: number): string {
  // Convert job duration to hours
  const durationHours = jobDuration / (60 * 60 * 1000);

  if (durationHours < 1) {
    return "5m";
  } else if (durationHours < 24) {
    return durationHours < 3 ? "15m" : "1h";
  } else if (durationHours < 168) {
    return "1d";
  } else {
    return "7d";
  }
}

// Fixed function to safely extract value from Prometheus result
function extractPrometheusValue(item: any): number {
  try {
    if (!item || !item.value) return 0;

    // Handle array format [timestamp, value]
    if (Array.isArray(item.value) && item.value.length >= 2) {
      const numericValue = parseFloat(item.value[1]);
      return isNaN(numericValue) ? 0 : numericValue;
    }

    // Handle object format with value property
    if (
      typeof item.value === "object" &&
      item.value !== null &&
      "value" in item.value
    ) {
      const numericValue = parseFloat(item.value.value);
      return isNaN(numericValue) ? 0 : numericValue;
    }

    // Handle direct string or number
    if (typeof item.value === "string" || typeof item.value === "number") {
      const numericValue = parseFloat(item.value);
      return isNaN(numericValue) ? 0 : numericValue;
    }

    return 0;
  } catch (error) {
    console.error("Error extracting Prometheus value:", error);
    return 0;
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
  const offset = parseInt(searchParams.get("offset") || "0");
  const jobFilter = searchParams.get("jobId") || "";

  // Get sorting parameters
  const sort = searchParams.get("sort") || "";
  const order = searchParams.get("order") || "asc";

  // Flag to indicate whether to include Slurm job details
  const includeSlurmDetails = searchParams.get("includeDetails") === "true";

  console.log(
    `Processing request with: threshold=${threshold}, limit=${limit}, offset=${offset}, jobFilter=${jobFilter}, sort=${sort}, order=${order}, includeSlurmDetails=${includeSlurmDetails}`
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

    // Extract job IDs from the result and normalize them
    const allJobIds = underutilizedResult.result
      .map((item) => {
        // Get the job ID from the metric
        const jobId = item.metric?.hpc_job || item.metric?.labels?.hpc_job;

        if (!jobId) {
          return null;
        }

        // Check if jobId is a string and only contains a number (Slurm job ID)
        if (typeof jobId === "string" && /^\d+$/.test(jobId)) {
          // Slurm API expects numeric job IDs
          return jobId;
        }

        // For job IDs with prefixes or other formats, try to extract just the numeric part
        const matches = jobId.match(/(\d+)$/);
        if (matches && matches[1]) {
          return matches[1];
        }

        return jobId;
      })
      .filter(Boolean); // Remove nulls

    console.log(
      `Extracted ${allJobIds.length} job IDs for Slurm lookup:`,
      allJobIds
    );

    // Calculate total count for pagination
    const totalCount = allJobIds.length;

    if (allJobIds.length === 0) {
      console.log("No underutilized jobs found");
      return NextResponse.json({
        status: 200,
        data: {
          jobs: [],
          total: 0,
        },
      });
    }

    // Apply sorting and pagination to the job IDs first
    // This helps us only fetch metrics for the jobs we actually need to display
    let sortedJobIds = [...allJobIds];

    // If we need to sort, we'll need to fetch metrics for all jobs before sorting
    const needsSorting = sort === "utilization";

    // For non-sorting cases, we can just paginate the job IDs directly
    // and only fetch metrics for the paginated jobs
    if (!needsSorting) {
      // Apply pagination to job IDs
      sortedJobIds = allJobIds.slice(offset, offset + limit);
    }

    // Now that we have a potentially filtered list of jobs, fetch metrics just for those
    const jobSelector = `{hpc_job=~"${sortedJobIds.join("|")}"}`;

    console.log(
      `Querying metrics for ${sortedJobIds.length} jobs with selector: ${jobSelector}`
    );

    // Fetch metrics for the subset of jobs
    const [
      currentUtilResults,
      memUtilResults,
      memMaxResults,
      gpuCountResults,
      historicalUtilResults,
    ] = await Promise.all([
      prom.instantQuery(`job:gpu_utilization:current_avg${jobSelector}`),
      prom.instantQuery(`job:gpu_memory:current_avg_pct${jobSelector}`),
      prom.instantQuery(`job:gpu_memory:current_max_pct${jobSelector}`),
      prom.instantQuery(`job:gpu_count:current${jobSelector}`),
      prom
        .instantQuery(`job:gpu_utilization:1d_avg${jobSelector}`)
        .catch(() => ({ result: [] })),
    ]);

    // Create a map of job metrics for easy lookup
    const metricsMap: Record<string, any> = {};

    // Process metrics results with proper value extraction
    [
      { result: currentUtilResults.result, key: "currentUtilization" },
      { result: historicalUtilResults.result, key: "historicalUtilization" },
      { result: memUtilResults.result, key: "memoryUtilization" },
      { result: memMaxResults.result, key: "maxMemoryUtilization" },
      { result: gpuCountResults.result, key: "gpuCount" },
    ].forEach(({ result, key }) => {
      if (!result) return;

      result.forEach((item: any) => {
        // Handle different possible structures of the metric
        let jobId = item.metric?.hpc_job || item.metric?.labels?.hpc_job;
        if (!jobId) return;

        // Normalize job ID to match what we use for Slurm lookup
        if (typeof jobId === "string" && !/^\d+$/.test(jobId)) {
          const matches = jobId.match(/(\d+)$/);
          if (matches && matches[1]) {
            jobId = matches[1]; // Use just the numeric part
          }
        }

        if (!metricsMap[jobId]) {
          metricsMap[jobId] = {};
        }

        // Use our improved value extraction function
        const value = extractPrometheusValue(item);
        metricsMap[jobId][key] = value;
      });
    });

    // Build the job details array with Prometheus metrics
    let jobDetails = sortedJobIds.map((jobId) => {
      const metrics = metricsMap[jobId] || {};

      // Default time values if we don't have Slurm data
      const startTime = Date.now() - 600000; // Default to 10 min ago
      const jobDuration = Date.now() - startTime;
      const timeWindow = getTimeWindow(jobDuration);
      const isNewJob = jobDuration < 1800000; // 30 minutes in milliseconds

      // For running average, use historical data when available, but use current for new jobs
      const gpuUtilization =
        !isNewJob && metrics.historicalUtilization !== undefined
          ? metrics.historicalUtilization
          : metrics.currentUtilization || 0;

      return {
        jobId,
        gpuUtilization: gpuUtilization,
        currentUtilization: metrics.currentUtilization || 0,
        historicalUtilization: metrics.historicalUtilization || 0,
        memoryUtilization: metrics.memoryUtilization || 0,
        maxMemoryUtilization: metrics.maxMemoryUtilization || 0,
        // Ensure gpuCount is at least 1 and is an integer
        gpuCount: Math.max(1, Math.round(metrics.gpuCount || 1)),
        startTime,
        timeWindow,
        isNewJob,
        // Don't include Slurm data
        hasSlurmData: false,
      };
    });

    // If we need to sort, do it now that we have the metrics
    if (needsSorting) {
      if (order === "asc") {
        jobDetails.sort((a, b) => a.gpuUtilization - b.gpuUtilization);
      } else {
        jobDetails.sort((a, b) => b.gpuUtilization - a.gpuUtilization);
      }

      // Now apply pagination to the sorted jobs
      jobDetails = jobDetails.slice(offset, offset + limit);
    }

    console.log(`Returning ${jobDetails.length} jobs from offset ${offset}`);

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
