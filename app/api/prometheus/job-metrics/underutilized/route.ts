import { NextRequest, NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";
import { URL } from "url";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

let prom: PrometheusDriver | null = null;

if (PROMETHEUS_URL) {
  prom = new PrometheusDriver({
    endpoint: PROMETHEUS_URL,
    baseURL: "/api/v1",
  });
}

// Function to fetch job information from Slurm
async function fetchSlurmJobInfo(jobId: string) {
  try {
    console.log(`Fetching Slurm data for job ${jobId}`);

    const apiUrl = `/api/slurm/job/${jobId}`;
    console.log(`Using Slurm API URL: ${apiUrl}`);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}${apiUrl}`
    );

    if (!response.ok) {
      console.error(
        `Failed to fetch Slurm data for job ${jobId}: ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    const dataPreview = JSON.stringify(data).substring(0, 200);
    console.log(
      `Slurm API response for job ${jobId} (preview): ${dataPreview}...`
    );

    if (data && data.jobs && data.jobs.length > 0) {
      console.log(`Successfully found Slurm data for job ${jobId}`);
      return data.jobs[0];
    } else {
      console.warn(`No job data found in Slurm response for job ${jobId}`);
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Slurm data for job ${jobId}:`, error);
    return null;
  }
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

  console.log(
    `Processing request with: threshold=${threshold}, limit=${limit}, offset=${offset}, jobFilter=${jobFilter}, sort=${sort}, order=${order}`
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

    // Step 1: Get current utilization and other metrics
    const allJobsSelector = `{hpc_job=~"${allJobIds.join("|")}"}`;

    console.log("Querying current job metrics with selector:", allJobsSelector);
    const [currentUtilResults, memUtilResults, memMaxResults, gpuCountResults] =
      await Promise.all([
        prom.instantQuery(`job:gpu_utilization:current_avg${allJobsSelector}`),
        prom.instantQuery(`job:gpu_memory:current_avg_pct${allJobsSelector}`),
        prom.instantQuery(`job:gpu_memory:current_max_pct${allJobsSelector}`),
        prom.instantQuery(`job:gpu_count:current${allJobsSelector}`),
      ]);

    // Step 2: Get historical average data
    console.log("Getting historical utilization data...");
    let historicalUtilResults: any = { result: [] };

    try {
      // Get 1d average - good balance for performance
      historicalUtilResults = await prom.instantQuery(
        `job:gpu_utilization:1d_avg${allJobsSelector}`
      );
      console.log(
        `Retrieved ${historicalUtilResults.result.length} historical averages`
      );
    } catch (error) {
      console.error("Error fetching historical data:", error);
      // Fall back to current values if historical fails
      historicalUtilResults = currentUtilResults;
    }

    // Create a map of job metrics for easy lookup
    const metricsMap: Record<string, any> = {};

    // Process current metric results with proper value extraction
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

        // Log the extracted values for debugging
        console.log(`Extracted ${key} for job ${jobId}: ${value}`);

        metricsMap[jobId][key] = value;
      });
    });

    // Step 3: Fetch Slurm job information in parallel
    console.log("Fetching Slurm job information...");
    const slurmJobsPromises = allJobIds.map((jobId) =>
      fetchSlurmJobInfo(jobId)
    );
    const slurmJobsResults = await Promise.all(slurmJobsPromises);

    // Create a map of Slurm job data with more detailed logging
    const slurmJobMap: Record<string, any> = {};
    slurmJobsResults.forEach((jobData, index) => {
      const jobId = allJobIds[index];
      if (jobData) {
        console.log(`Adding Slurm data for job ${jobId} to map`);
        slurmJobMap[jobId] = jobData;
      } else {
        console.warn(`No Slurm data found for job ${jobId}`);
      }
    });

    console.log(
      `Retrieved Slurm data for ${Object.keys(slurmJobMap).length} out of ${
        allJobIds.length
      } jobs`
    );

    // Step 4: Build the job details array with both Prometheus metrics and Slurm data
    const allJobDetails = allJobIds.map((jobId) => {
      const metrics = metricsMap[jobId] || {};
      const slurmData = slurmJobMap[jobId];

      // Get start time from Slurm if available, or fallback to a recent time
      let startTime: number;
      let jobName = "";
      let userName = "";
      let jobState = "";
      let timeLimit = 0;
      let tresInfo = "";

      if (slurmData) {
        // Extract Slurm job information
        if (
          slurmData.start_time &&
          typeof slurmData.start_time === "object" &&
          "number" in slurmData.start_time
        ) {
          startTime = slurmData.start_time.number * 1000; // Convert to milliseconds
        } else if (typeof slurmData.start_time === "number") {
          startTime = slurmData.start_time * 1000; // Convert to milliseconds
        } else {
          startTime = Date.now() - 600000; // Default to 10 min ago
        }

        // Get job name
        jobName = slurmData.name || "";

        // Get username
        userName = slurmData.user_name || "";

        // Get job state - handle both string and array formats
        if (Array.isArray(slurmData.job_state)) {
          jobState = slurmData.job_state.join(", ");
        } else if (typeof slurmData.job_state === "string") {
          jobState = slurmData.job_state;
        } else {
          jobState = "";
        }

        // Get time limit
        if (
          slurmData.time_limit &&
          typeof slurmData.time_limit === "object" &&
          "number" in slurmData.time_limit
        ) {
          timeLimit = slurmData.time_limit.number || 0;
        } else if (typeof slurmData.time_limit === "number") {
          timeLimit = slurmData.time_limit;
        }

        // Get TRES info (resources)
        tresInfo = slurmData.tres_per_node || "";

        console.log(`Successfully populated Slurm data for job ${jobId}:`, {
          jobName,
          userName,
          jobState,
          timeLimit,
          tresInfo,
          startTime: new Date(startTime).toISOString(),
        });
      } else {
        // Fallback if no Slurm data available
        startTime = Date.now() - 600000; // Default to 10 min ago
        console.log(
          `Using fallback data for job ${jobId} with startTime ${new Date(
            startTime
          ).toISOString()}`
        );
      }

      const jobDuration = Date.now() - startTime;
      const timeWindow = getTimeWindow(jobDuration);

      // For very new jobs (less than 30 minutes), use current values only
      const isNewJob = jobDuration < 1800000; // 30 minutes in milliseconds

      // For running average, use historical data when available, but use current for new jobs
      const gpuUtilization =
        !isNewJob && metrics.historicalUtilization !== undefined
          ? metrics.historicalUtilization
          : metrics.currentUtilization || 0;

      // Log the final values for debugging
      console.log(`Final values for job ${jobId}:`, {
        gpuUtilization,
        currentUtilization: metrics.currentUtilization,
        historicalUtilization: metrics.historicalUtilization,
        memoryUtilization: metrics.memoryUtilization,
        maxMemoryUtilization: metrics.maxMemoryUtilization,
        gpuCount: metrics.gpuCount,
      });

      return {
        jobId,
        jobName,
        userName,
        jobState,
        timeLimit,
        tresInfo,
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
        hasSlurmData: !!slurmData,
      };
    });

    // Apply sorting if requested
    if (sort === "utilization") {
      console.log(`Sorting by utilization, order: ${order}`);
      if (order === "asc") {
        allJobDetails.sort((a, b) => a.gpuUtilization - b.gpuUtilization);
      } else {
        allJobDetails.sort((a, b) => b.gpuUtilization - a.gpuUtilization);
      }
    }

    // Now apply pagination after sorting
    const paginatedJobs = allJobDetails.slice(offset, offset + limit);
    console.log(
      `Applied pagination: ${paginatedJobs.length} jobs from offset ${offset}`
    );

    return NextResponse.json({
      status: 200,
      data: {
        jobs: paginatedJobs,
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
