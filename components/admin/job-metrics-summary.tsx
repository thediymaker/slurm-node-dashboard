// components/admin/job-metrics-summary.tsx
"use client";

import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ServerCrash,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

type SummaryData = {
  [key: string]: {
    avgUtilization: number;
    underutilizedCount: number;
    totalJobs: number;
    underutilizedPercentage: number;
  };
};

export type JobMetricsSummaryRef = {
  refreshData: () => void;
};

const JobMetricsSummary = forwardRef<JobMetricsSummaryRef, {}>((props, ref) => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/prometheus/job-metrics/summary");

      if (!response.ok) {
        throw new Error("Failed to fetch summary data");
      }

      const result = await response.json();

      if (result.status === 200 && result.data) {
        setData(result.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching summary data:", err);
      setError("Failed to load job metrics summary");
    } finally {
      setIsLoading(false);
    }
  };

  // Expose the refreshData function to parent components
  useImperativeHandle(ref, () => ({
    refreshData: fetchData,
  }));

  useEffect(() => {
    fetchData();
    // No automatic refresh interval anymore
  }, []);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const timeRanges = [
    { key: "1d", label: "Last 24 Hours" },
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
  ];

  // Determine if utilization trend is improving or declining
  const getUtilizationTrend = () => {
    if (!data) return "neutral";

    const oneDayUtil = data["1d"]?.avgUtilization || 0;
    const sevenDayUtil = data["7d"]?.avgUtilization || 0;

    return oneDayUtil > sevenDayUtil ? "improving" : "declining";
  };

  // Check if no jobs are running
  const noJobs = data && data["1d"]?.totalJobs === 0;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Overall GPU Utilization Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Average GPU Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : noJobs ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ServerCrash className="h-5 w-5" />
                <span>No active GPU jobs</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="text-3xl font-bold">
                  {data?.["1d"]?.avgUtilization.toFixed(1)}%
                </div>
                <div className="ml-auto">
                  {getUtilizationTrend() === "improving" ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                  )}
                </div>
              </div>
              <Progress
                value={data?.["1d"]?.avgUtilization || 0}
                className="h-2"
              />
              <div className="text-xs text-muted-foreground">
                {getUtilizationTrend() === "improving"
                  ? "Trend: Improving compared to previous period"
                  : "Trend: Declining compared to previous period"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Underutilized Jobs Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Underutilized Jobs (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : noJobs ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ServerCrash className="h-5 w-5" />
                <span>No active GPU jobs</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="text-3xl font-bold">
                  {data?.["1d"]?.underutilizedCount || 0}
                </div>
                <div className="ml-2 text-sm text-muted-foreground">
                  of {data?.["1d"]?.totalJobs || 0} jobs
                </div>
                <div className="ml-auto">
                  {(data?.["1d"]?.underutilizedPercentage || 0) > 30 ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </div>
              <Progress
                value={data?.["1d"]?.underutilizedPercentage || 0}
                className="h-2"
              />
              <div className="text-xs text-muted-foreground">
                {(data?.["1d"]?.underutilizedPercentage || 0).toFixed(1)}% of
                jobs are underutilized
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Range Comparisons */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Utilization by Time Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {timeRanges.map((range) => (
                <Skeleton key={range.key} className="h-6 w-full" />
              ))}
            </div>
          ) : noJobs ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ServerCrash className="h-5 w-5" />
                <span>No active GPU jobs</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {timeRanges.map((range) => (
                <div key={range.key} className="grid grid-cols-2 gap-2">
                  <div className="text-sm font-medium">{range.label}</div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={data?.[range.key]?.avgUtilization || 0}
                      className="h-2"
                    />
                    <span className="text-sm">
                      {(data?.[range.key]?.avgUtilization || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              <div className="text-xs text-muted-foreground mt-2">
                Comparing utilization across different time periods
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

// Display name for React DevTools
JobMetricsSummary.displayName = "JobMetricsSummary";

export default JobMetricsSummary;
