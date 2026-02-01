// app/api/reporting/gpu/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { fetchSlurmData } from "@/lib/slurm-api";

const STALE_JOB_THRESHOLD_SECONDS = 30; // Consider a job stale if no metrics in the last 30 seconds

// Helper to extract a value from prometheus result
const extractValue = (result: any): number | null => {
  try {
    if (!result?.result || !result.result[0]) return null;

    const item = result.result[0];

    // Handle different response formats
    if (item.value) {
      // Format: { time: "...", value: 80 } or [timestamp, "80"]
      if (typeof item.value === "object" && item.value.value !== undefined) {
        return parseFloat(item.value.value);
      } else if (Array.isArray(item.value) && item.value.length > 1) {
        return parseFloat(item.value[1]);
      } else {
        return parseFloat(item.value);
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting value:", error);
    return null;
  }
};

// Helper to extract series from prometheus result
const extractSeries = (result: any): any[] => {
  try {
    if (!result?.result || !Array.isArray(result.result)) return [];

    return result.result.map((item: any) => {
      const metric = item.metric || {};
      const labels = metric.labels || {};

      // Get job ID - try both direct access and labels
      const jobId = labels.hpc_job || metric.hpc_job || "unknown";

      // Get value based on different formats
      let value = 0;
      if (item.value) {
        if (typeof item.value === "object" && item.value.value !== undefined) {
          value = parseFloat(item.value.value);
        } else if (Array.isArray(item.value) && item.value.length > 1) {
          value = parseFloat(item.value[1]);
          // Capture timestamp if available
          if (item.value.length > 0 && typeof item.value[0] === "number") {
            return {
              jobId,
              labels,
              value: isNaN(value) ? 0 : value,
              hostname: labels.Hostname || metric.Hostname || "unknown",
              gpuModel: labels.modelName || metric.modelName || "unknown",
              timestamp: item.value[0],
            };
          }
        } else {
          value = parseFloat(item.value);
        }
      }

      return {
        jobId,
        labels,
        value: isNaN(value) ? 0 : value,
        hostname: labels.Hostname || metric.Hostname || "unknown",
        gpuModel: labels.modelName || metric.modelName || "unknown",
        timestamp: Date.now() / 1000, // Default to current time if no timestamp found
      };
    });
  } catch (error) {
    console.error("Error extracting series:", error);
    return [];
  }
};

// Check if a job is stale (no recent metrics)
const checkJobFreshness = async (jobId: string): Promise<boolean> => {
  if (!prom) return false;

  try {
    // Use a slightly larger window for freshness check (2 minutes instead of 30 seconds)
    // This is more tolerant of temporarily missing metrics
    const freshnessWindow = 120; // seconds

    // Query last timestamp for this job
    const query = `last_over_time(DCGM_FI_DEV_GPU_UTIL{hpc_job="${jobId}"}[${freshnessWindow}s])`;
    const result = await prom.instantQuery(query);

    // Check if we have results
    const isFresh = result && result.result && result.result.length > 0;

    return isFresh;
  } catch (error) {
    console.error(`Error checking job freshness for ${jobId}:`, error);
    // In case of error checking freshness, default to considering it fresh
    // This is safer than incorrectly filtering out active jobs
    return true;
  }
};

// Get the actual running jobs from Slurm
const getRunningJobsFromSlurm = async (): Promise<Set<string>> => {
  try {
    const { data, error } = await fetchSlurmData('/jobs');

    if (error || !data?.jobs || !Array.isArray(data.jobs)) {
      console.warn("Failed to fetch jobs from Slurm API");
      return new Set<string>();
    }

    const runningJobs = new Set<string>();
    data.jobs.forEach((job: any) => {
      // Only include jobs in RUNNING state
      const state = Array.isArray(job.job_state) ? job.job_state[0] : job.job_state;
      if (state?.toUpperCase() === "RUNNING" && job.job_id) {
        runningJobs.add(job.job_id.toString());
      }
    });

    return runningJobs;
  } catch (err) {
    console.error("Error fetching running jobs from Slurm:", err);
    return new Set<string>();
  }
};

// Check if recording rules are available
const checkRecordingRulesAvailable = async (): Promise<boolean> => {
  if (!prom) return false;

  try {
    // Try to query a recording rule
    const testQuery = "job:gpu_utilization:current_avg";
    const result = await prom.instantQuery(testQuery);

    // Check if we got valid results
    return result && Array.isArray(result.result) && result.result.length > 0;
  } catch (error) {
    // Recording rules not available, will fall back to direct queries
    return false;
  }
};

// Query GPU metrics using recording rules
const queryWithRecordingRules = async (timeRange: string, jobId?: string) => {
  if (!prom) throw new Error("Prometheus not configured");

  // System-wide metrics queries
  const systemQueries = {
    avgUtilization: "system:gpu_utilization:avg",
    underutilizedCount: "system:underutilized_jobs:count",
    wastedGpuHours: "system:wasted_gpu_hours:total",
  };

  // Job-specific queries
  const jobQueries = jobId
    ? {
        utilization: `job:gpu_utilization:${timeRange}_avg{hpc_job="${jobId}"}`,
        currentUtil: `job:gpu_utilization:current_avg{hpc_job="${jobId}"}`,
        gpuCount: `job:gpu_count:current{hpc_job="${jobId}"}`,
        duration: `job:duration_seconds:current{hpc_job="${jobId}"}`,
        isUnderutilized: `job:is_underutilized:4h{hpc_job="${jobId}"}`,
      }
    : {
        allJobs: `job:gpu_utilization:${timeRange}_avg`,
        currentJobs: `job:gpu_utilization:current_avg`,
        underutilizedJobs: `system:underutilized_jobs:${timeRange}`,
      };

  // Build combined queries
  const allQueries = { ...systemQueries, ...(jobQueries as any) };

  // Execute all queries in parallel
  const results: Record<string, any> = {};
  const promises = Object.entries(allQueries).map(async ([key, query]: any) => {
    try {
      const result = await prom!.instantQuery(query);

      if (
        key === "allJobs" ||
        key === "currentJobs" ||
        key === "underutilizedJobs"
      ) {
        results[key] = extractSeries(result);
      } else {
        results[key] = extractValue(result);
      }
    } catch (error) {
      console.error(`Error executing recording rule query ${key}:`, error);
      results[key] = null;
    }
  });

  await Promise.all(promises);
  return results;
};

// Query GPU metrics using direct DCGM queries
const queryWithDirectMetrics = async (timeRange: string, jobId?: string) => {
  if (!prom) throw new Error("Prometheus not configured");

  // Get active jobs from Slurm
  const runningJobs = await getRunningJobsFromSlurm();

  // Base DCGM query
  const baseQuery = jobId
    ? `DCGM_FI_DEV_GPU_UTIL{hpc_job="${jobId}"}`
    : 'DCGM_FI_DEV_GPU_UTIL{hpc_job!="0", hpc_job!=""}';

  // Get current utilization
  const utilResult = await prom.instantQuery(baseQuery);
  const gpuSeries = extractSeries(utilResult);

  // Check freshness of each job we find in metrics
  const jobFreshnessPromises = new Map<string, Promise<boolean>>();
  const jobIds = new Set<string>();

  for (const gpu of gpuSeries) {
    if (
      gpu.jobId &&
      gpu.jobId !== "unknown" &&
      gpu.jobId !== "0" &&
      gpu.jobId !== ""
    ) {
      jobIds.add(gpu.jobId);

      // Only check if we haven't checked this job yet
      if (!jobFreshnessPromises.has(gpu.jobId)) {
        jobFreshnessPromises.set(gpu.jobId, checkJobFreshness(gpu.jobId));
      }
    }
  }

  // Get results of freshness checks
  const freshJobs = new Set<string>();
  for (const [jobId, promise] of jobFreshnessPromises.entries()) {
    try {
      const isFresh = await promise;

      // Only include job if it's fresh OR if it's in the runningJobs set from Slurm API
      if (isFresh || runningJobs.has(jobId)) {
        freshJobs.add(jobId);
      }
    } catch (error) {
      console.error(`Error checking freshness for job ${jobId}:`, error);
    }
  }

  // Process results by job (include jobs that are either fresh OR in the Slurm running list)
  const jobMap = new Map();
  let totalUtilization = 0;
  let validResults = 0;

  // If we have zero jobs from both Slurm and freshness checks, include all jobs as a fallback
  const useAllJobs = freshJobs.size === 0 && runningJobs.size === 0;

  for (const gpu of gpuSeries) {
    try {
      // Skip invalid job IDs
      if (gpu.jobId === "unknown" || gpu.jobId === "0" || gpu.jobId === "") {
        continue;
      }

      // Include job if:
      // 1. It's in the freshJobs set (has recent metrics), OR
      // 2. It's in the runningJobs set (from Slurm API), OR
      // 3. We're using the fallback approach (no active jobs found)
      if (
        !freshJobs.has(gpu.jobId) &&
        !runningJobs.has(gpu.jobId) &&
        !useAllJobs
      ) {
        continue;
      }

      const utilValue = gpu.value;

      if (!isNaN(utilValue)) {
        totalUtilization += utilValue;
        validResults++;
      }

      if (!jobMap.has(gpu.jobId)) {
        jobMap.set(gpu.jobId, {
          jobId: gpu.jobId,
          avgUtilization: utilValue,
          gpuCount: 1,
          isUnderutilized: utilValue < 30,
          nodeNames: [gpu.hostname],
          gpuModel: gpu.gpuModel,
        });
      } else {
        const job = jobMap.get(gpu.jobId);

        // Recalculate average (weighted by GPU count)
        const oldTotal = job.avgUtilization * job.gpuCount;
        job.gpuCount += 1;
        job.avgUtilization = (oldTotal + utilValue) / job.gpuCount;
        job.isUnderutilized = job.avgUtilization < 30;

        // Add node if not already in the list
        if (gpu.hostname && !job.nodeNames.includes(gpu.hostname)) {
          job.nodeNames.push(gpu.hostname);
        }
      }
    } catch (error) {
      console.error("Error processing GPU result:", error);
    }
  }

  // Convert job map to array
  const jobs = Array.from(jobMap.values());

  // Calculate system metrics
  const avgUtilization = validResults > 0 ? totalUtilization / validResults : 0;
  const underutilizedCount = jobs.filter((job) => job.isUnderutilized).length;

  // Calculate wasted GPU hours
  let wastedGpuHours = 0;
  for (const job of jobs) {
    // Query job duration if we need it
    if (jobId) {
      try {
        const durationQuery = `(time() - min_over_time(timestamp(DCGM_FI_DEV_GPU_UTIL{hpc_job="${job.jobId}"})[${timeRange}:]))/3600`;
        const durationResult = await prom.instantQuery(durationQuery);
        const duration = extractValue(durationResult) || 24; // Default to 24h if we can't determine

        const wastedFraction = (100 - job.avgUtilization) / 100;
        wastedGpuHours += wastedFraction * job.gpuCount * duration;
      } catch (error) {
        console.error(
          `Error calculating wasted hours for job ${job.jobId}:`,
          error
        );
      }
    }
  }

  // In case we couldn't calculate individual job waste, use an estimation
  if (wastedGpuHours === 0 && jobs.length > 0) {
    // Estimate 24 hours per GPU
    for (const job of jobs) {
      const wastedFraction = (100 - job.avgUtilization) / 100;
      wastedGpuHours += wastedFraction * job.gpuCount * 24;
    }
  }

  return {
    avgUtilization,
    underutilizedCount,
    wastedGpuHours,
    jobs,
  };
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id") || undefined;
  const timeRange = url.searchParams.get("timeRange") || "7d";

  if (!prom) {
    return NextResponse.json({
      status: 404,
      message: "Prometheus not configured",
    });
  }

  try {
    // Check if recording rules are available
    const recordingRulesAvailable = await checkRecordingRulesAvailable();

    if (recordingRulesAvailable) {
      // Use recording rules
      const ruleResults = await queryWithRecordingRules(timeRange, jobId);

      // Get active jobs for filtering
      const runningJobs = await getRunningJobsFromSlurm();

      if (jobId) {
        // Check if this specific job is running
        const isRunning = runningJobs.has(jobId);

        // Only return data if job is running
        if (!isRunning) {
          return NextResponse.json({
            status: 404,
            message: `Job ${jobId} is not currently running`,
          });
        }

        // Job-specific response
        return NextResponse.json({
          status: 200,
          data: {
            jobId,
            averageUtilization:
              ruleResults.utilization || ruleResults.currentUtil || 0,
            gpuCount: ruleResults.gpuCount || 1,
            duration: ruleResults.duration ? ruleResults.duration / 3600 : 0, // Convert to hours
            wastedGpuHours: ruleResults.wastedGpuHours || 0,
            isUnderutilized: ruleResults.isUnderutilized === 1,
          },
        });
      } else {
        // System overview response
        const allJobs = ruleResults.allJobs || ruleResults.currentJobs || [];
        const underutilizedJobIds = new Set();

        // Collect underutilized job IDs
        if (
          ruleResults.underutilizedJobs &&
          Array.isArray(ruleResults.underutilizedJobs)
        ) {
          ruleResults.underutilizedJobs.forEach((job) => {
            if (job.jobId && job.jobId !== "unknown") {
              underutilizedJobIds.add(job.jobId);
            }
          });
        }

        // If we have zero running jobs from Slurm, include all jobs as a fallback
        const useAllJobs = runningJobs.size === 0;

        // Filter and format jobs - include jobs that are in the running set OR using fallback
        const jobs = allJobs
          .filter((job: any) => {
            const isValidJob =
              job.jobId && job.jobId !== "unknown" && job.jobId !== "0";
            const isRunningInSlurm = runningJobs.has(job.jobId);

            // Include if it's a valid job AND (it's running in Slurm OR we're using fallback)
            return isValidJob && (isRunningInSlurm || useAllJobs);
          })
          .map((job: any) => ({
            jobId: job.jobId,
            avgUtilization: job.value,
            isUnderutilized: underutilizedJobIds.has(job.jobId),
          }));

        // Recalculate average utilization based on filtered jobs
        let totalUtilization = 0;
        jobs.forEach((job: any) => {
          totalUtilization += job.avgUtilization;
        });
        const avgUtilization =
          jobs.length > 0 ? totalUtilization / jobs.length : 0;

        return NextResponse.json({
          status: 200,
          data: {
            systemMetrics: {
              averageUtilization: avgUtilization,
              underutilizedJobCount: jobs.filter(
                (job: any) => job.isUnderutilized
              ).length,
              totalWastedGpuHours: ruleResults.wastedGpuHours || 0,
              totalJobs: jobs.length,
            },
            jobs,
          },
        });
      }
    } else {
      // Fall back to direct metrics - this already includes the job freshness checks
      const directResults = await queryWithDirectMetrics(timeRange, jobId);

      if (jobId) {
        // Get the specific job
        const job = directResults.jobs.find((j: any) => j.jobId === jobId);

        if (!job) {
          return NextResponse.json({
            status: 404,
            message: `Job ${jobId} not found or not currently running`,
          });
        }

        return NextResponse.json({
          status: 200,
          data: {
            jobId,
            averageUtilization: job.avgUtilization,
            gpuCount: job.gpuCount,
            duration: 0, // No duration information
            wastedGpuHours: 0, // No waste calculation
            isUnderutilized: job.isUnderutilized,
          },
        });
      } else {
        // Return system overview
        return NextResponse.json({
          status: 200,
          data: {
            systemMetrics: {
              averageUtilization: directResults.avgUtilization,
              underutilizedJobCount: directResults.underutilizedCount,
              totalWastedGpuHours: Math.round(directResults.wastedGpuHours),
              totalJobs: directResults.jobs.length,
            },
            jobs: directResults.jobs.map((job: any) => ({
              jobId: job.jobId,
              avgUtilization: job.avgUtilization,
              gpuCount: job.gpuCount,
              isUnderutilized: job.isUnderutilized,
              nodeNames: job.nodeNames,
              gpuModel: job.gpuModel,
            })),
          },
        });
      }
    }
  } catch (error) {
    console.error("Error fetching GPU metrics:", error);

    // Try to fall back to direct metrics if something went wrong
    try {
      const directResults = await queryWithDirectMetrics(timeRange, jobId);

      return NextResponse.json({
        status: 200,
        data: {
          systemMetrics: {
            averageUtilization: directResults.avgUtilization,
            underutilizedJobCount: directResults.underutilizedCount,
            totalWastedGpuHours: Math.round(directResults.wastedGpuHours),
            totalJobs: directResults.jobs.length,
          },
          jobs: directResults.jobs,
        },
        _error: "Used fallback metrics due to error",
        _errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (fallbackError) {
      console.error("Even fallback metrics failed:", fallbackError);

      return NextResponse.json({
        status: 500,
        message: "Error fetching GPU metrics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
