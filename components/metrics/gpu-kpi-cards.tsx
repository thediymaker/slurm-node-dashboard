"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge } from "lucide-react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

interface GPUOverviewData {
  avgUtilization: number;
  memoryUtilization: number;
  totalGPUs: number;
  totalJobs: number;
  underutilizedJobs: number;
}

interface GPUOverviewResponse {
  status: number;
  data?: GPUOverviewData;
  message?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function GPUKPICards() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const apiUrl = (() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `/api/gpu?${qs}` : "/api/gpu";
  })();

  const { data, error, isLoading } = useSWR<GPUOverviewResponse>(
    apiUrl,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || data?.status !== 200 || !data?.data) {
    return null;
  }

  const stats = data.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Avg GPU Utilization</CardTitle>
        <Gauge className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {stats.avgUtilization.toFixed(0)}%
        </div>
        <p className={`text-xs ${stats.underutilizedJobs > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
          {stats.underutilizedJobs > 0
            ? `${stats.underutilizedJobs} job${stats.underutilizedJobs !== 1 ? "s" : ""} below 30%`
            : "GPU compute usage"}
        </p>
      </CardContent>
    </Card>
  );
}
