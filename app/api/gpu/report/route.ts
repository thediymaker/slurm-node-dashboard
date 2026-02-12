export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { fetchSlurmData } from "@/lib/slurm-api";
import { extractValue, extractSeries, extractNumericValue, checkRecordingRulesAvailable } from "@/lib/gpu-metrics";

// ─── Slurm Integration ──────────────────────────────────────────────────────

interface SlurmJobInfo {
  userName: string;
  account: string;
}

const getRunningJobsFromSlurm = async (): Promise<{ jobIds: Set<string>; jobInfo: Map<string, SlurmJobInfo> }> => {
  try {
    const { data, error } = await fetchSlurmData('/jobs');

    if (error || !data?.jobs || !Array.isArray(data.jobs)) {
      console.warn("Failed to fetch jobs from Slurm API");
      return { jobIds: new Set<string>(), jobInfo: new Map() };
    }

    const jobIds = new Set<string>();
    const jobInfo = new Map<string, SlurmJobInfo>();

    data.jobs.forEach((job: any) => {
      const state = Array.isArray(job.job_state) ? job.job_state[0] : job.job_state;
      if (state?.toUpperCase() === "RUNNING" && job.job_id) {
        const jobIdStr = job.job_id.toString();
        jobIds.add(jobIdStr);
        jobInfo.set(jobIdStr, {
          userName: job.user_name || job.user || "",
          account: job.account || "",
        });
      }
    });

    return { jobIds, jobInfo };
  } catch (err) {
    console.error("Error fetching running jobs from Slurm:", err);
    return { jobIds: new Set<string>(), jobInfo: new Map() };
  }
};

// ─── Freshness Check ─────────────────────────────────────────────────────────

const checkJobFreshness = async (jobId: string): Promise<boolean> => {
  if (!prom) return false;

  try {
    const freshnessWindow = 120;
    const query = `last_over_time(DCGM_FI_DEV_GPU_UTIL{hpc_job="${jobId}"}[${freshnessWindow}s])`;
    const result = await prom.instantQuery(query);
    return result && result.result && result.result.length > 0;
  } catch (error) {
    console.error(`Error checking job freshness for ${jobId}:`, error);
    return true;
  }
};

// ─── Recording Rules Path ────────────────────────────────────────────────────

const queryWithRecordingRules = async (timeRange: string, jobId?: string) => {
  if (!prom) throw new Error("Prometheus not configured");

  const systemQueries = {
    avgUtilization: "system:gpu_utilization:avg",
    underutilizedCount: "system:underutilized_jobs:count",
    wastedGpuHours: "system:wasted_gpu_hours:total",
  };

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

  const allQueries = { ...systemQueries, ...(jobQueries as any) };

  const results: Record<string, any> = {};
  const promises = Object.entries(allQueries).map(async ([key, query]: any) => {
    try {
      const result = await prom!.instantQuery(query);

      if (key === "allJobs" || key === "currentJobs" || key === "underutilizedJobs") {
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

// ─── Direct DCGM Query Path ─────────────────────────────────────────────────

const queryWithDirectMetrics = async (timeRange: string, jobId?: string) => {
  if (!prom) throw new Error("Prometheus not configured");

  const { jobIds: runningJobs, jobInfo: slurmJobInfo } = await getRunningJobsFromSlurm();

  const baseQuery = jobId
    ? `DCGM_FI_DEV_GPU_UTIL{hpc_job="${jobId}"}`
    : 'DCGM_FI_DEV_GPU_UTIL{hpc_job!="0", hpc_job!=""}';

  const utilResult = await prom.instantQuery(baseQuery);
  const gpuSeries = extractSeries(utilResult);

  // Check freshness
  const jobFreshnessPromises = new Map<string, Promise<boolean>>();
  const jobIds = new Set<string>();

  for (const gpu of gpuSeries) {
    if (gpu.jobId && gpu.jobId !== "unknown" && gpu.jobId !== "0" && gpu.jobId !== "") {
      jobIds.add(gpu.jobId);
      if (!jobFreshnessPromises.has(gpu.jobId)) {
        jobFreshnessPromises.set(gpu.jobId, checkJobFreshness(gpu.jobId));
      }
    }
  }

  const freshJobs = new Set<string>();
  for (const [jid, promise] of jobFreshnessPromises.entries()) {
    try {
      const isFresh = await promise;
      if (isFresh || runningJobs.has(jid)) {
        freshJobs.add(jid);
      }
    } catch (error) {
      console.error(`Error checking freshness for job ${jid}:`, error);
    }
  }

  // Process results
  const jobMap = new Map();
  let totalUtilization = 0;
  let validResults = 0;
  const useAllJobs = freshJobs.size === 0 && runningJobs.size === 0;

  for (const gpu of gpuSeries) {
    try {
      if (gpu.jobId === "unknown" || gpu.jobId === "0" || gpu.jobId === "") continue;
      if (!freshJobs.has(gpu.jobId) && !runningJobs.has(gpu.jobId) && !useAllJobs) continue;

      const utilValue = gpu.value;
      if (!isNaN(utilValue)) {
        totalUtilization += utilValue;
        validResults++;
      }

      if (!jobMap.has(gpu.jobId)) {
        const userInfo = slurmJobInfo.get(gpu.jobId);
        jobMap.set(gpu.jobId, {
          jobId: gpu.jobId,
          userName: userInfo?.userName || "",
          account: userInfo?.account || "",
          avgUtilization: utilValue,
          gpuCount: 1,
          isUnderutilized: utilValue < 30,
          nodeNames: [gpu.hostname],
          gpuModel: gpu.gpuModel,
        });
      } else {
        const job = jobMap.get(gpu.jobId);
        const oldTotal = job.avgUtilization * job.gpuCount;
        job.gpuCount += 1;
        job.avgUtilization = (oldTotal + utilValue) / job.gpuCount;
        job.isUnderutilized = job.avgUtilization < 30;
        if (gpu.hostname && !job.nodeNames.includes(gpu.hostname)) {
          job.nodeNames.push(gpu.hostname);
        }
      }
    } catch (error) {
      console.error("Error processing GPU result:", error);
    }
  }

  const jobs = Array.from(jobMap.values());
  const avgUtilization = validResults > 0 ? totalUtilization / validResults : 0;
  const underutilizedCount = jobs.filter((job) => job.isUnderutilized).length;

  // Calculate wasted GPU hours
  let wastedGpuHours = 0;
  if (jobId) {
    for (const job of jobs) {
      try {
        const durationQuery = `(time() - min_over_time(timestamp(DCGM_FI_DEV_GPU_UTIL{hpc_job="${job.jobId}"})[${timeRange}:]))/3600`;
        const durationResult = await prom.instantQuery(durationQuery);
        const duration = extractValue(durationResult) || 24;
        const wastedFraction = (100 - job.avgUtilization) / 100;
        wastedGpuHours += wastedFraction * job.gpuCount * duration;
      } catch (error) {
        console.error(`Error calculating wasted hours for job ${job.jobId}:`, error);
      }
    }
  }

  if (wastedGpuHours === 0 && jobs.length > 0) {
    for (const job of jobs) {
      const wastedFraction = (100 - job.avgUtilization) / 100;
      wastedGpuHours += wastedFraction * job.gpuCount * 24;
    }
  }

  return { avgUtilization, underutilizedCount, wastedGpuHours, jobs };
};

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id") || undefined;
  const timeRange = url.searchParams.get("timeRange") || "7d";

  if (!prom) {
    return NextResponse.json({ status: 404, message: "Prometheus not configured" });
  }

  try {
    const recordingRulesAvailable = await checkRecordingRulesAvailable();

    if (recordingRulesAvailable) {
      const ruleResults = await queryWithRecordingRules(timeRange, jobId);
      const { jobIds: runningJobs, jobInfo: slurmJobInfo } = await getRunningJobsFromSlurm();

      if (jobId) {
        if (!runningJobs.has(jobId)) {
          return NextResponse.json({ status: 404, message: `Job ${jobId} is not currently running` });
        }

        return NextResponse.json({
          status: 200,
          data: {
            jobId,
            averageUtilization: ruleResults.utilization || ruleResults.currentUtil || 0,
            gpuCount: ruleResults.gpuCount || 1,
            duration: ruleResults.duration ? ruleResults.duration / 3600 : 0,
            wastedGpuHours: ruleResults.wastedGpuHours || 0,
            isUnderutilized: ruleResults.isUnderutilized === 1,
          },
        });
      } else {
        const allJobs = ruleResults.allJobs || ruleResults.currentJobs || [];
        const underutilizedJobIds = new Set();

        if (ruleResults.underutilizedJobs && Array.isArray(ruleResults.underutilizedJobs)) {
          ruleResults.underutilizedJobs.forEach((job: any) => {
            if (job.jobId && job.jobId !== "unknown") underutilizedJobIds.add(job.jobId);
          });
        }

        const useAllJobs = runningJobs.size === 0;

        const jobs = allJobs
          .filter((job: any) => {
            const isValidJob = job.jobId && job.jobId !== "unknown" && job.jobId !== "0";
            const isRunningInSlurm = runningJobs.has(job.jobId);
            return isValidJob && (isRunningInSlurm || useAllJobs);
          })
          .map((job: any) => {
            const userInfo = slurmJobInfo.get(job.jobId);
            return {
              jobId: job.jobId,
              userName: userInfo?.userName || "",
              account: userInfo?.account || "",
              avgUtilization: job.value,
              isUnderutilized: underutilizedJobIds.has(job.jobId),
            };
          });

        let totalUtilization = 0;
        jobs.forEach((job: any) => { totalUtilization += job.avgUtilization; });
        const avgUtilization = jobs.length > 0 ? totalUtilization / jobs.length : 0;

        return NextResponse.json({
          status: 200,
          data: {
            systemMetrics: {
              averageUtilization: avgUtilization,
              underutilizedJobCount: jobs.filter((job: any) => job.isUnderutilized).length,
              totalWastedGpuHours: ruleResults.wastedGpuHours || 0,
              totalJobs: jobs.length,
            },
            jobs,
          },
        });
      }
    } else {
      const directResults = await queryWithDirectMetrics(timeRange, jobId);

      if (jobId) {
        const job = directResults.jobs.find((j: any) => j.jobId === jobId);

        if (!job) {
          return NextResponse.json({ status: 404, message: `Job ${jobId} not found or not currently running` });
        }

        return NextResponse.json({
          status: 200,
          data: {
            jobId,
            averageUtilization: job.avgUtilization,
            gpuCount: job.gpuCount,
            duration: 0,
            wastedGpuHours: 0,
            isUnderutilized: job.isUnderutilized,
          },
        });
      } else {
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
              userName: job.userName,
              account: job.account,
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
