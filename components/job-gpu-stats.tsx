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

const gpuRubric: Record<string, { threshold: number; color: string; barClass: string; label: string }> = {
  A: {
    threshold: 85,
    color: "text-emerald-600 dark:text-emerald-400",
    barClass: "bg-emerald-500",
    label: "Excellent",
  },
  B: {
    threshold: 70,
    color: "text-sky-600 dark:text-sky-400",
    barClass: "bg-sky-500",
    label: "Strong",
  },
  C: {
    threshold: 50,
    color: "text-foreground",
    barClass: "bg-primary/75",
    label: "Good",
  },
  D: {
    threshold: 30,
    color: "text-amber-600 dark:text-amber-400",
    barClass: "bg-amber-500",
    label: "Low",
  },
  E: {
    threshold: 0,
    color: "text-red-600 dark:text-red-400",
    barClass: "bg-red-500",
    label: "Underutilized",
  },
};

const getGpuUtilizationGrade = (score: number): keyof typeof gpuRubric => {
  for (const [key, subobj] of Object.entries(gpuRubric)) {
    if (score >= subobj.threshold) return key as keyof typeof gpuRubric;
  }
  return "E";
};

interface JobGPUStatsProps {
  jobId: string;
  variant?: "compact" | "full" | "badge";
}

export function JobGPUStats({ jobId, variant = "compact" }: JobGPUStatsProps) {
  const gpuUrl = `/api/gpu?job_id=${encodeURIComponent(jobId)}`;
  const { data, isLoading } = useSWR<GPUJobResponse>(
    gpuUtilizationPluginMetadata.isEnabled ? gpuUrl : null,
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
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5" />
          GPU Metrics
        </span>
        <span className="text-xs text-muted-foreground">
          {isHistorical ? "Historical average" : "Live average"}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border bg-card transition-colors hover:bg-muted/30">
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Avg GPU Utilization
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
              GPU Memory Used
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
              Allocated GPUs
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

interface GPUUtilizationBadgeProps {
  jobId: string;
  source?: "auto" | "database";
}

export function GPUUtilizationBadge({ jobId, source = "auto" }: GPUUtilizationBadgeProps) {
  const sourceQuery = source === "database" ? "&source=database" : "";
  const gpuUrl = `/api/gpu?job_id=${encodeURIComponent(jobId)}${sourceQuery}`;
  const { data, isLoading } = useSWR<GPUJobResponse>(
    gpuUtilizationPluginMetadata.isEnabled ? gpuUrl : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!gpuUtilizationPluginMetadata.isEnabled) return null;

  if (isLoading) {
    return (
      <div className="p-3 rounded-md border bg-muted/30">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-6 w-16" />
      </div>
    );
  }

  if (!data?.data || data.status !== 200) {
    return null;
  }

  const value = data.data.avgUtilization;
  const grade = getGpuUtilizationGrade(value);
  const gradeInfo = gpuRubric[grade];
  const sourceLabel = data.data.source === "database" || data.data.isComplete
    ? "Historical average"
    : "Live average";

  return (
    <div className="p-3 rounded-md border bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          GPU Utilization
        </span>
        <span className={`text-sm font-semibold ${gradeInfo.color}`}>
          {grade}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-medium tabular-nums">
          {value.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${gradeInfo.barClass}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{sourceLabel}</span>
        <span className={gradeInfo.color}>{gradeInfo.label}</span>
      </div>
    </div>
  );
}
