"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, AlertTriangle } from "lucide-react";
import { gpuUtilizationPluginMetadata } from "@/actions/plugins";

interface GPUJobData {
  jobId: string;
  avgUtilization: number;
  p95Utilization: number;
  memoryPct: number;
  gpuCount: number;
  isUnderutilized: boolean;
  source?: "prometheus" | "database";
  isComplete?: boolean;
}

interface GPUJobResponse {
  status: number;
  data?: GPUJobData;
  message?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface JobGPUStatsProps {
  jobId: string;
  variant?: "compact" | "full" | "badge";
}

export function JobGPUStats({ jobId, variant = "compact" }: JobGPUStatsProps) {
  const { data, isLoading } = useSWR<GPUJobResponse>(
    gpuUtilizationPluginMetadata.isEnabled ? `/api/prometheus/gpu-job?job_id=${jobId}` : null,
    fetcher,
    { 
      refreshInterval: (latestData) => {
        if (latestData?.data?.isComplete || latestData?.data?.source === "database") {
          return 0;
        }
        return 30000;
      },
      revalidateOnFocus: false,
    }
  );

  if (!gpuUtilizationPluginMetadata.isEnabled) return null;

  if (isLoading) {
    if (variant === "badge") {
      return <Skeleton className="h-5 w-16 inline-block" />;
    }
    return (
      <div className="p-3 rounded-lg border bg-muted/30">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-6 w-16" />
      </div>
    );
  }

  if (!data?.data || data.status !== 200) {
    return null;
  }

  const stats = data.data;
  const isLow = stats.avgUtilization < 30;

  if (variant === "badge") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
          isLow
            ? "bg-amber-500/15 text-amber-400"
            : stats.avgUtilization >= 70
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-blue-500/15 text-blue-400"
        }`}
      >
        <Gauge className="h-3 w-3" />
        GPU {stats.avgUtilization.toFixed(0)}%
        {isLow && <AlertTriangle className="h-3 w-3" />}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className="p-3 rounded-lg border bg-muted/30 text-center">
        <div className="text-xs text-muted-foreground mb-1">GPU Util</div>
        <div
          className={`font-semibold ${
            isLow ? "text-amber-400" : stats.avgUtilization >= 70 ? "text-emerald-400" : "text-primary"
          }`}
        >
          {stats.avgUtilization.toFixed(0)}%
        </div>
        {isLow && (
          <div className="text-[10px] text-amber-400 flex items-center justify-center gap-0.5 mt-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            Low
          </div>
        )}
      </div>
    );
  }

  const isHistorical = stats.source === "database" || stats.isComplete;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">GPU Util (Avg)</div>
          <div
            className={`font-semibold text-lg ${
              isLow ? "text-amber-400" : stats.avgUtilization >= 70 ? "text-emerald-400" : "text-primary"
            }`}
          >
            {stats.avgUtilization.toFixed(0)}%
          </div>
        </div>
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">GPU Util ({isHistorical ? "Max" : "P95"})</div>
          <div className="font-semibold text-lg">{stats.p95Utilization.toFixed(0)}%</div>
        </div>
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">GPU Memory</div>
          <div className="font-semibold text-lg">{stats.memoryPct.toFixed(0)}%</div>
        </div>
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">GPU Count</div>
          <div className="font-semibold text-lg">{stats.gpuCount}</div>
        </div>
      </div>
      {isLow && (
        <div className="text-xs text-amber-400 flex items-center justify-center gap-1 py-1 bg-amber-500/10 rounded-md">
          <AlertTriangle className="h-3 w-3" />
          This job {isHistorical ? "underutilized" : "appears to be underutilizing"} its allocated GPUs
        </div>
      )}
    </div>
  );
}

interface GPUEfficiencyBadgeProps {
  jobId: string;
}

const rubric: { [key: string]: { threshold: number; color: string } } = {
  A: { threshold: 90, color: "text-foreground" },
  B: { threshold: 80, color: "text-foreground" },
  C: { threshold: 70, color: "text-muted-foreground" },
  D: { threshold: 60, color: "text-muted-foreground" },
  E: { threshold: 0, color: "text-muted-foreground" },
};

const getLetterGrade = (score: number): keyof typeof rubric => {
  for (const [key, subobj] of Object.entries(rubric)) {
    if (score >= subobj.threshold) return key as keyof typeof rubric;
  }
  return "E";
};

export function GPUEfficiencyBadge({ jobId }: GPUEfficiencyBadgeProps) {
  const { data, isLoading } = useSWR<GPUJobResponse>(
    gpuUtilizationPluginMetadata.isEnabled ? `/api/prometheus/gpu-job?job_id=${jobId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!gpuUtilizationPluginMetadata.isEnabled) return null;

  if (isLoading) {
    return (
      <div className="p-3 rounded-md border bg-muted/30">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-5 w-12" />
      </div>
    );
  }

  if (!data?.data || data.status !== 200) {
    return null;
  }

  const value = data.data.avgUtilization;
  const grade = getLetterGrade(value);
  const gradeInfo = rubric[grade];

  return (
    <div className="p-3 rounded-md border bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">GPU Efficiency</span>
        <span className={`text-sm font-semibold ${gradeInfo.color}`}>{grade}</span>
      </div>
      <div className="text-base font-medium">{value.toFixed(1)}%</div>
    </div>
  );
}
