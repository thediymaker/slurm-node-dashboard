"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Gauge, MemoryStick, Cpu, AlertTriangle } from "lucide-react";
import useSWR from "swr";

interface GPUOverviewData {
  avgUtilization: number;
  p95Utilization: number;
  memoryUtilization: number;
  totalGPUs: number;
  activeJobs: number;
  underutilizedJobs: number;
}

interface GPUOverviewResponse {
  status: number;
  data?: GPUOverviewData;
  message?: string;
  source?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const UtilizationGauge = ({ value, label }: { value: number; label: string }) => {
  const getColor = (val: number) => {
    if (val >= 70) return "text-emerald-500";
    if (val >= 40) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`text-3xl font-bold ${getColor(value)}`}>
        {value.toFixed(0)}%
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
};

export function GPUUtilizationCards() {
  const { data, error, isLoading } = useSWR<GPUOverviewResponse>(
    "/api/prometheus/gpu-overview",
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Real-Time GPU Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || data?.status !== 200 || !data?.data) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Real-Time GPU Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{data?.message || "Unable to fetch GPU metrics from Prometheus"}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data.data;
  const hasUnderutilized = stats.underutilizedJobs > 0;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Real-Time GPU Utilization
          {hasUnderutilized && (
            <span className="ml-2 text-xs font-normal text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {stats.underutilizedJobs} underutilized job{stats.underutilizedJobs > 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <UtilizationGauge value={stats.avgUtilization} label="Avg Utilization" />
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <UtilizationGauge value={stats.p95Utilization} label="P95 Utilization" />
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <UtilizationGauge value={stats.memoryUtilization} label="Memory Used" />
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <div className="text-3xl font-bold text-primary">{stats.totalGPUs}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              Active GPUs
            </div>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <div className="text-3xl font-bold text-primary">{stats.activeJobs}</div>
            <div className="text-xs text-muted-foreground">GPU Jobs Running</div>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
            <div className={`text-3xl font-bold ${hasUnderutilized ? "text-amber-500" : "text-emerald-500"}`}>
              {stats.underutilizedJobs}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Underutilized (&lt;30%)
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground text-right">
          Source: {data.source === "recording_rules" ? "Prometheus Recording Rules" : "Direct DCGM Query"}
        </div>
      </CardContent>
    </Card>
  );
}
