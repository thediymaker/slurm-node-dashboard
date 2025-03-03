// components/admin/JobDetailsPanel.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  Cpu,
  Clock,
  ServerCrash,
  Database,
  BarChart2,
  RefreshCw,
  CalendarClock,
  HelpCircle,
  BarChart4,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface JobDetail {
  jobId: string;
  startTime?: Date;
  duration?: number;
  gpuCount?: number;
  gpuUtilization: {
    avg: number;
    max: number;
    p95: number;
    trend: { timestamp: number; value: number }[];
  };
  memoryUtilization: {
    avg: number;
    max: number;
    trend: { timestamp: number; value: number }[];
  };
}

interface JobDetailsPanelProps {
  jobId: string;
}

export default function JobDetailsPanel({ jobId }: JobDetailsPanelProps) {
  const [jobDetails, setJobDetails] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "1d" | "7d">("1d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "details">(
    "overview"
  );

  const fetchJobDetails = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/prometheus/job-metrics?jobId=${jobId}&period=${timeRange}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch job details");
      }

      const result = await response.json();

      if (result.status === 200 && result.data) {
        // Process the data from Prometheus
        const processedData: JobDetail = {
          jobId,
          gpuUtilization: {
            avg: 0,
            max: 0,
            p95: 0,
            trend: [],
          },
          memoryUtilization: {
            avg: 0,
            max: 0,
            trend: [],
          },
        };

        // Check if we have GPU utilization data
        if (
          result.data.gpuUtilization?.result &&
          result.data.gpuUtilization.result.length > 0
        ) {
          const gpuData = result.data.gpuUtilization.result[0];

          // Extract values for time series
          if (gpuData.values) {
            processedData.gpuUtilization.trend = gpuData.values.map(
              (point: [number, string]) => ({
                timestamp: point[0] * 1000, // Convert to milliseconds
                value: parseFloat(point[1]),
              })
            );
          }

          // Extract metric metadata
          if (gpuData.metric) {
            if (gpuData.metric.start_time) {
              processedData.startTime = new Date(
                parseInt(gpuData.metric.start_time) * 1000
              );
            }
          }
        }

        // Check if we have memory utilization data
        if (
          result.data.memoryUtilization?.result &&
          result.data.memoryUtilization.result.length > 0
        ) {
          const memData = result.data.memoryUtilization.result[0];

          // Extract values for time series
          if (memData.values) {
            processedData.memoryUtilization.trend = memData.values.map(
              (point: [number, string]) => ({
                timestamp: point[0] * 1000, // Convert to milliseconds
                value: parseFloat(point[1]),
              })
            );
          }
        }

        // Extract current metrics from instantQuery results
        if (result.data.currentMetrics?.result) {
          for (const metric of result.data.currentMetrics.result) {
            if (!metric.metric || !metric.value) continue;

            const metricName = Object.keys(metric.metric).find((key) =>
              key.startsWith("gpu_")
            );
            if (!metricName) continue;

            const value = parseFloat(metric.value[1]);

            if (metricName === "gpu_util") {
              processedData.gpuUtilization.avg = value;
            } else if (metricName === "gpu_util_p95") {
              processedData.gpuUtilization.p95 = value;
            } else if (metricName === "gpu_mem") {
              processedData.memoryUtilization.avg = value;
            } else if (metricName === "gpu_mem_max") {
              processedData.memoryUtilization.max = value;
            } else if (metricName === "gpu_count") {
              processedData.gpuCount = value;
            }
          }
        }

        // Calculate max GPU utilization from trend data
        if (processedData.gpuUtilization.trend.length > 0) {
          processedData.gpuUtilization.max = Math.max(
            ...processedData.gpuUtilization.trend.map((point) => point.value)
          );
        }

        // Calculate max Memory utilization from trend data
        if (processedData.memoryUtilization.trend.length > 0) {
          processedData.memoryUtilization.max = Math.max(
            ...processedData.memoryUtilization.trend.map((point) => point.value)
          );
        }

        // If we have start time, calculate duration
        if (processedData.startTime) {
          const now = new Date();
          processedData.duration =
            now.getTime() - processedData.startTime.getTime();
        }

        setJobDetails(processedData);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching job details:", err);
      setError("Failed to load job details");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load of data
  useEffect(() => {
    setIsLoading(true);
    if (jobId) {
      fetchJobDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, timeRange]);

  // Setup auto-refresh for active tabs
  useEffect(() => {
    if (activeTab === "overview") {
      const interval = setInterval(() => {
        fetchJobDetails();
      }, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Prepare chart data - combine GPU and memory utilization
  const chartData = useMemo(() => {
    if (!jobDetails) return [];

    const { gpuUtilization, memoryUtilization } = jobDetails;

    // Create map of timestamps to make merging easier
    const dataMap = new Map();

    // Add GPU utilization data
    gpuUtilization.trend.forEach((point) => {
      dataMap.set(point.timestamp, {
        time: point.timestamp,
        gpuUtilization: point.value,
        memoryUtilization: null,
      });
    });

    // Add memory utilization data
    memoryUtilization.trend.forEach((point) => {
      if (dataMap.has(point.timestamp)) {
        dataMap.get(point.timestamp).memoryUtilization = point.value;
      } else {
        dataMap.set(point.timestamp, {
          time: point.timestamp,
          gpuUtilization: null,
          memoryUtilization: point.value,
        });
      }
    });

    // Convert to array and sort by timestamp
    return Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
  }, [jobDetails]);

  // Format duration string
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Custom tooltip formatter
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-md p-3 shadow-md">
          <p className="text-sm font-medium text-foreground">
            {format(label, "MMM d, yyyy HH:mm:ss")}
          </p>
          <div className="mt-2 space-y-1">
            {payload.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {item.name}:{" "}
                  {item.value !== null
                    ? `${Number(item.value).toFixed(2)}%`
                    : "N/A"}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate utilization classes and status
  const getUtilizationStatus = (value: number) => {
    if (value < 30) return { color: "text-red-500", status: "Low" };
    if (value < 60) return { color: "text-yellow-500", status: "Moderate" };
    return { color: "text-green-500", status: "Optimal" };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Low":
        return (
          <Badge variant="destructive" className="ml-2">
            Low
          </Badge>
        );
      case "Moderate":
        return (
          <Badge
            variant="outline"
            className="ml-2 bg-yellow-700 text-yellow-100"
          >
            Moderate
          </Badge>
        );
      case "Optimal":
        return (
          <Badge variant="default" className="ml-2">
            Optimal
          </Badge>
        );
      default:
        return null;
    }
  };

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (
    !jobDetails ||
    (!jobDetails.gpuUtilization.trend.length &&
      !jobDetails.memoryUtilization.trend.length)
  ) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <ServerCrash className="h-12 w-12" />
              <p className="text-lg font-medium">
                No data available for job {jobId}
              </p>
              <p>
                This may be because the job hasn't started yet, has completed,
                or hasn't reported metrics.
              </p>
              <Button
                className="mt-4"
                onClick={fetchJobDetails}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // GPU utilization status
  const gpuStatus = getUtilizationStatus(jobDetails.gpuUtilization.avg);
  const memStatus = getUtilizationStatus(jobDetails.memoryUtilization.avg);

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex flex-col">
              <CardTitle className="text-xl flex items-center">
                Job {jobId}
                {jobDetails.startTime && (
                  <Badge variant="outline" className="ml-3">
                    Running
                  </Badge>
                )}
              </CardTitle>
              {jobDetails.startTime && (
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  Started{" "}
                  {formatDistanceToNow(jobDetails.startTime, {
                    addSuffix: true,
                  })}
                  <span className="text-xs text-muted-foreground/70 ml-1">
                    ({format(jobDetails.startTime, "MMM d, yyyy HH:mm:ss")})
                  </span>
                </CardDescription>
              )}
            </div>

            <div className="flex items-center gap-3 mt-2 md:mt-0">
              <Select
                value={timeRange}
                onValueChange={(value) => setTimeRange(value as any)}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="1d">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchJobDetails}
                disabled={isRefreshing}
                className="h-8"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Detailed Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* GPU Count Card */}
            <Card className="border-border hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">
                      GPU Allocation
                    </div>
                    <div className="text-2xl font-bold">
                      {jobDetails.gpuCount || "0"}
                    </div>
                  </div>
                  <div className="p-3 rounded-full bg-blue-500/10">
                    <Cpu className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average GPU Utilization Card */}
            <Card className="border-border hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground flex items-center">
                        GPU Utilization
                        {getStatusBadge(gpuStatus.status)}
                      </div>
                      <div className={`text-2xl font-bold ${gpuStatus.color}`}>
                        {jobDetails.gpuUtilization.avg.toFixed(1)}%
                      </div>
                    </div>
                    <div
                      className={`p-3 rounded-full bg-${
                        gpuStatus.status === "Low"
                          ? "red"
                          : gpuStatus.status === "Moderate"
                          ? "yellow"
                          : "green"
                      }-500/10`}
                    >
                      <BarChart4 className={`h-6 w-6 ${gpuStatus.color}`} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress
                      value={jobDetails.gpuUtilization.avg}
                      className={cn(
                        "h-2",
                        gpuStatus.status === "Low"
                          ? "bg-red-500"
                          : gpuStatus.status === "Moderate"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      )}
                    />
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>
                        Peak: {jobDetails.gpuUtilization.max.toFixed(1)}%
                      </span>
                      <span>
                        P95: {jobDetails.gpuUtilization.p95.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Utilization Card */}
            <Card className="border-border hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground flex items-center">
                        Memory Utilization
                        {getStatusBadge(memStatus.status)}
                      </div>
                      <div className={`text-2xl font-bold ${memStatus.color}`}>
                        {jobDetails.memoryUtilization.avg.toFixed(1)}%
                      </div>
                    </div>
                    <div
                      className={`p-3 rounded-full bg-${
                        memStatus.status === "Low"
                          ? "red"
                          : memStatus.status === "Moderate"
                          ? "yellow"
                          : "green"
                      }-500/10`}
                    >
                      <Database className={`h-6 w-6 ${memStatus.color}`} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress
                      value={jobDetails.memoryUtilization.avg}
                      className={cn(
                        "h-2",
                        memStatus.status === "Low"
                          ? "bg-red-500"
                          : memStatus.status === "Moderate"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      )}
                    />
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>
                        Peak: {jobDetails.memoryUtilization.max.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Utilization Chart */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <BarChart2 className="mr-2 h-5 w-5" />
                Utilization Trends
              </CardTitle>
              <CardDescription>
                GPU and memory utilization over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="gpuGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                      <linearGradient
                        id="memGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#a855f7"
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="95%"
                          stopColor="#a855f7"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.1}
                      stroke="#555"
                    />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(timestamp) => format(timestamp, "HH:mm")}
                      minTickGap={60}
                      stroke="#888"
                      tick={{ fontSize: 11, fill: "#aaa" }}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[0, 100]}
                      stroke="#3b82f6"
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fontSize: 11, fill: "#aaa" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      stroke="#a855f7"
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fontSize: 11, fill: "#aaa" }}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ color: "#ddd" }}>{value}</span>
                      )}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="gpuUtilization"
                      name="GPU Utilization"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#gpuGradient)"
                      activeDot={{ r: 6, fill: "#3b82f6" }}
                      connectNulls
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="memoryUtilization"
                      name="Memory Utilization"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fill="url(#memGradient)"
                      activeDot={{ r: 6, fill: "#a855f7" }}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Job Metrics Overview</CardTitle>
              <CardDescription>
                Detailed metrics for job {jobId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Job Details
                    </h3>
                    <div className="grid grid-cols-2 gap-y-2 rounded-lg border p-4">
                      <div className="text-sm text-muted-foreground">
                        Job ID:
                      </div>
                      <div className="text-sm font-medium">{jobId}</div>

                      <div className="text-sm text-muted-foreground">
                        Status:
                      </div>
                      <div className="text-sm font-medium">
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-500 hover:bg-green-500/20"
                        >
                          Running
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Started:
                      </div>
                      <div className="text-sm font-medium">
                        {jobDetails.startTime
                          ? format(jobDetails.startTime, "MMM d, yyyy HH:mm:ss")
                          : "N/A"}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Duration:
                      </div>
                      <div className="text-sm font-medium">
                        {jobDetails.duration
                          ? formatDuration(jobDetails.duration)
                          : "N/A"}
                      </div>

                      <div className="text-sm text-muted-foreground">GPUs:</div>
                      <div className="text-sm font-medium">
                        {jobDetails.gpuCount || "0"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      GPU Performance
                    </h3>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Average Utilization:
                        </span>
                        <span
                          className={`text-sm font-medium ${gpuStatus.color}`}
                        >
                          {jobDetails.gpuUtilization.avg.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Peak Utilization:
                        </span>
                        <span className="text-sm font-medium">
                          {jobDetails.gpuUtilization.max.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          P95 Utilization:
                        </span>
                        <span className="text-sm font-medium">
                          {jobDetails.gpuUtilization.p95.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            Efficiency Rating:
                          </span>
                          <span className="text-xs font-medium">
                            {gpuStatus.status}
                          </span>
                        </div>
                        <Progress
                          value={jobDetails.gpuUtilization.avg}
                          className={cn(
                            "h-2",
                            gpuStatus.status === "Low"
                              ? "bg-red-500"
                              : gpuStatus.status === "Moderate"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Memory Performance
                    </h3>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Average Utilization:
                        </span>
                        <span
                          className={`text-sm font-medium ${memStatus.color}`}
                        >
                          {jobDetails.memoryUtilization.avg.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Peak Utilization:
                        </span>
                        <span className="text-sm font-medium">
                          {jobDetails.memoryUtilization.max.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            Efficiency Rating:
                          </span>
                          <span className="text-xs font-medium">
                            {memStatus.status}
                          </span>
                        </div>
                        <Progress
                          value={jobDetails.memoryUtilization.avg}
                          className={cn(
                            "h-2",
                            memStatus.status === "Low"
                              ? "bg-red-500"
                              : memStatus.status === "Moderate"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Performance Assessment
                    </h3>
                    <div className="rounded-lg border p-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              gpuStatus.status === "Low"
                                ? "bg-red-500/10 text-red-500"
                                : gpuStatus.status === "Moderate"
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-green-500/10 text-green-500"
                            }`}
                          >
                            <BarChart4 className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium">
                              GPU Efficiency
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {gpuStatus.status === "Low"
                                ? "Low GPU utilization suggests this job isn't effectively using allocated resources. Consider reducing GPU count or optimizing the workload."
                                : gpuStatus.status === "Moderate"
                                ? "Moderate GPU utilization indicates room for optimization. Consider reviewing batch sizes or model parallelism settings."
                                : "Optimal GPU utilization indicates resources are being used efficiently."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              memStatus.status === "Low"
                                ? "bg-red-500/10 text-red-500"
                                : memStatus.status === "Moderate"
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-green-500/10 text-green-500"
                            }`}
                          >
                            <Database className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium">
                              Memory Efficiency
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {memStatus.status === "Low"
                                ? "Low memory utilization suggests this job isn't making full use of available GPU memory. Consider increasing batch size."
                                : memStatus.status === "Moderate"
                                ? "Moderate memory utilization is acceptable, but you might optimize further by adjusting data loading or model parameters."
                                : "Optimal memory utilization indicates GPU memory resources are being used efficiently."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <BarChart4 className="mr-2 h-5 w-5 text-blue-500" />
                  GPU Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="gpuGradient2"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.6}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.1}
                        stroke="#555"
                      />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(timestamp) =>
                          format(timestamp, "HH:mm")
                        }
                        minTickGap={60}
                        stroke="#888"
                        tick={{ fontSize: 11, fill: "#aaa" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        tick={{ fontSize: 11, fill: "#aaa" }}
                      />
                      <RechartsTooltip content={<CustomChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="gpuUtilization"
                        name="GPU Utilization"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#gpuGradient2)"
                        activeDot={{ r: 6, fill: "#3b82f6" }}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Database className="mr-2 h-5 w-5 text-purple-500" />
                  Memory Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="memGradient2"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#a855f7"
                            stopOpacity={0.6}
                          />
                          <stop
                            offset="95%"
                            stopColor="#a855f7"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.1}
                        stroke="#555"
                      />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(timestamp) =>
                          format(timestamp, "HH:mm")
                        }
                        minTickGap={60}
                        stroke="#888"
                        tick={{ fontSize: 11, fill: "#aaa" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        tick={{ fontSize: 11, fill: "#aaa" }}
                      />
                      <RechartsTooltip content={<CustomChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="memoryUtilization"
                        name="Memory Utilization"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fill="url(#memGradient2)"
                        activeDot={{ r: 6, fill: "#a855f7" }}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Optimization Recommendations */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <HelpCircle className="mr-2 h-5 w-5" />
                Optimization Recommendations
              </CardTitle>
              <CardDescription>
                Based on job utilization patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gpuStatus.status === "Low" && (
                  <div className="rounded-lg border border-red-800/30 bg-red-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-red-500">
                          Low GPU Utilization Detected
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your job is using only{" "}
                          {jobDetails.gpuUtilization.avg.toFixed(1)}% of
                          allocated GPU resources. Consider the following:
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                          <li>
                            Reduce the number of GPUs allocated to this job
                          </li>
                          <li>Increase batch size to improve throughput</li>
                          <li>Check for data loading bottlenecks</li>
                          <li>
                            Review your model architecture for parallelization
                            opportunities
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {(gpuStatus.status === "Moderate" ||
                  memStatus.status === "Moderate") && (
                  <div className="rounded-lg border border-yellow-800/30 bg-yellow-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-yellow-500">
                          Optimization Opportunities
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your job shows moderate resource utilization. Consider
                          fine-tuning:
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                          <li>Adjust batch size for better GPU utilization</li>
                          <li>Optimize data preprocessing pipelines</li>
                          <li>
                            Consider mixed-precision training if not already
                            using it
                          </li>
                          <li>
                            Review model architecture for potential bottlenecks
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {gpuStatus.status === "Optimal" &&
                  memStatus.status === "Optimal" && (
                    <div className="rounded-lg border border-green-800/30 bg-green-500/5 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-green-500">
                            Excellent Resource Utilization
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your job is efficiently utilizing allocated
                            resources. GPU utilization at{" "}
                            {jobDetails.gpuUtilization.avg.toFixed(1)}% and
                            memory utilization at{" "}
                            {jobDetails.memoryUtilization.avg.toFixed(1)}%
                            indicate optimal configuration.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium mb-2">
                    Additional Recommendations
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                    <li>
                      Monitor job progression over time to detect any
                      performance degradation
                    </li>
                    <li>
                      Consider setting up alerting for significant changes in
                      resource utilization
                    </li>
                    <li>
                      Document optimal configurations for similar workloads
                    </li>
                    <li>
                      Regularly review performance metrics to ensure continued
                      efficiency
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
