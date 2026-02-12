"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, AlertTriangle } from "lucide-react";
import { gpuUtilizationPluginMetadata } from "@/actions/plugins";

interface GPUJobData {
  jobId: string;
  avgUtilization: number;
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
    gpuUtilizationPluginMetadata.isEnabled ? `/api/gpu?job_id=${jobId}` : null,
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
      return <Skeleton className="h-6 w-20 inline-block rounded-full" />;
    }
    return (
      <div className="p-4 rounded-xl border bg-card">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  if (!data?.data || data.status !== 200) {
    return null;
  }

  const stats = data.data;
  const isLow = stats.avgUtilization < 30;
  const isHigh = stats.avgUtilization >= 70;
  const isMedium = !isLow && !isHigh;

  if (variant === "badge") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted border border-border text-muted-foreground transition-colors hover:bg-muted/80">
        <Gauge className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono tabular-nums">{stats.avgUtilization.toFixed(0)}%</span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className="p-4 rounded-xl border bg-card transition-colors hover:bg-muted/30">
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            GPU Utilization
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {stats.avgUtilization.toFixed(0)}
          </span>
          <span className="text-lg text-muted-foreground">%</span>
        </div>
        {isLow && (
          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Underutilized</span>
          </div>
        )}
        {isHigh && (
          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border">
            <span className="text-xs font-medium text-muted-foreground">Optimized</span>
          </div>
        )}
      </div>
    );
  }

  const isHistorical = stats.source === "database" || stats.isComplete;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border bg-card transition-colors hover:bg-muted/30">
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Avg Utilization
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {stats.avgUtilization.toFixed(0)}
            </span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card transition-colors hover:bg-muted/30">
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Memory
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {stats.memoryPct.toFixed(0)}
            </span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card transition-colors hover:bg-muted/30">
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              GPU Count
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {stats.gpuCount}
            </span>
            <span className="text-sm text-muted-foreground">GPU{stats.gpuCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {isLow && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            This job {isHistorical ? "underutilized" : "appears to be underutilizing"} its allocated GPUs
          </span>
        </div>
      )}
    </div>
  );
}

interface GPUEfficiencyBadgeProps {
  jobId: string;
}

const rubric: { [key: string]: { threshold: number; color: string; barClass: string } } = {
  A: { threshold: 90, color: "text-foreground", barClass: "bg-primary" },
  B: { threshold: 80, color: "text-foreground", barClass: "bg-primary/80" },
  C: { threshold: 70, color: "text-muted-foreground", barClass: "bg-muted-foreground/70" },
  D: { threshold: 60, color: "text-muted-foreground", barClass: "bg-muted-foreground/50" },
  E: { threshold: 0, color: "text-muted-foreground", barClass: "bg-muted-foreground/40" },
};

const getLetterGrade = (score: number): keyof typeof rubric => {
  for (const [key, subobj] of Object.entries(rubric)) {
    if (score >= subobj.threshold) return key as keyof typeof rubric;
  }
  return "E";
};

export function GPUEfficiencyBadge({ jobId }: GPUEfficiencyBadgeProps) {
  const { data, isLoading } = useSWR<GPUJobResponse>(
    gpuUtilizationPluginMetadata.isEnabled ? `/api/gpu?job_id=${jobId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!gpuUtilizationPluginMetadata.isEnabled) return null;

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl border bg-card">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-6 w-16" />
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
    <div className="p-4 rounded-xl border border-border bg-card transition-colors hover:bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
          Efficiency
        </span>
        <span className={`text-2xl font-bold ${gradeInfo.color}`}>
          {grade}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold tabular-nums ${gradeInfo.color}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${gradeInfo.barClass}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}