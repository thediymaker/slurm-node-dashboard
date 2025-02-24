"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QueueTimesReportProps {
  data?: any;
}

interface QueueTimeData {
  partition: string;
  qos: string;
  waitTime: number; // in minutes
  jobCount: number;
}

interface WaitTimeTrend {
  timestamp: string;
  compute: number;
  gpu: number;
  interactive: number;
}

const QueueTimesReport: React.FC<QueueTimesReportProps> = ({ data }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [queueTimeData, setQueueTimeData] = useState<QueueTimeData[]>([]);
  const [waitTimeTrends, setWaitTimeTrends] = useState<WaitTimeTrend[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalJobs: 0,
    avgWaitTimeAll: 0,
    avgWaitTimeCompute: 0,
    avgWaitTimeGpu: 0,
    maxWaitTime: 0,
  });
  const [activeTab, setActiveTab] = useState("overview");

  const COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777"];

  const partitionColors = {
    compute: "#2563eb",
    gpu: "#c026d3",
    interactive: "#10b981",
  };

  // Function to fetch queue time data
  const fetchQueueTimeData = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch data from your Prometheus/InfluxDB
      // For this prototype, we'll generate mock data
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API delay

      // Generate mock data for queue times by partition and QoS
      const partitions = ["compute", "gpu", "interactive"];
      const qosLevels = ["normal", "high", "low"];

      const mockData = [];

      for (const partition of partitions) {
        for (const qos of qosLevels) {
          // Different partitions and QoS levels have different typical wait times
          let baseWaitTime;
          if (partition === "gpu") {
            baseWaitTime = 120; // GPU jobs wait longer
          } else if (partition === "compute") {
            baseWaitTime = 60;
          } else {
            baseWaitTime = 15; // Interactive jobs are faster
          }

          // QoS also affects wait time
          let qosMultiplier;
          if (qos === "high") {
            qosMultiplier = 0.5; // High QoS = faster
          } else if (qos === "normal") {
            qosMultiplier = 1;
          } else {
            qosMultiplier = 2; // Low QoS = slower
          }

          const waitTime =
            baseWaitTime * qosMultiplier * (0.8 + Math.random() * 0.4); // Add some randomness

          mockData.push({
            partition,
            qos,
            waitTime: parseFloat(waitTime.toFixed(1)),
            jobCount: Math.floor(Math.random() * 50) + 10,
          });
        }
      }

      setQueueTimeData(mockData);

      // Generate time trend data (24 hours)
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = (new Date().getHours() - 23 + i + 24) % 24; // Go back 23 hours and wrap around
        return `${hour}:00`;
      });

      const trendData = hours.map((hour) => {
        // Create a sine wave pattern with different phases for each partition
        const timeIndex = parseInt(hour.split(":")[0]);

        // Compute partition: peak during work hours
        const computeBase = 60;
        const computeWait =
          computeBase * (1 + 0.5 * Math.sin(((timeIndex - 2) * Math.PI) / 12));

        // GPU partition: steady high demand
        const gpuBase = 120;
        const gpuWait =
          gpuBase * (1 + 0.3 * Math.sin(((timeIndex - 4) * Math.PI) / 12));

        // Interactive partition: peaks in morning and afternoon
        const interactiveBase = 15;
        const interactiveWait =
          interactiveBase *
          (1 +
            (0.8 *
              (Math.sin(((timeIndex - 1) * Math.PI) / 6) +
                Math.sin(((timeIndex - 7) * Math.PI) / 6))) /
              2);

        return {
          timestamp: hour,
          compute: parseFloat(computeWait.toFixed(1)),
          gpu: parseFloat(gpuWait.toFixed(1)),
          interactive: parseFloat(interactiveWait.toFixed(1)),
        };
      });

      setWaitTimeTrends(trendData);

      // Calculate summary statistics
      const totalJobs = mockData.reduce((acc, item) => acc + item.jobCount, 0);

      const waitTimeSum = mockData.reduce(
        (acc, item) => acc + item.waitTime * item.jobCount,
        0
      );
      const avgWaitTimeAll = waitTimeSum / totalJobs;

      const computeJobs = mockData.filter(
        (item) => item.partition === "compute"
      );
      const computeWaitTimeSum = computeJobs.reduce(
        (acc, item) => acc + item.waitTime * item.jobCount,
        0
      );
      const computeJobCount = computeJobs.reduce(
        (acc, item) => acc + item.jobCount,
        0
      );
      const avgWaitTimeCompute = computeWaitTimeSum / computeJobCount;

      const gpuJobs = mockData.filter((item) => item.partition === "gpu");
      const gpuWaitTimeSum = gpuJobs.reduce(
        (acc, item) => acc + item.waitTime * item.jobCount,
        0
      );
      const gpuJobCount = gpuJobs.reduce((acc, item) => acc + item.jobCount, 0);
      const avgWaitTimeGpu = gpuWaitTimeSum / gpuJobCount;

      const maxWaitTime = Math.max(...mockData.map((item) => item.waitTime));

      setSummaryStats({
        totalJobs,
        avgWaitTimeAll: parseFloat(avgWaitTimeAll.toFixed(1)),
        avgWaitTimeCompute: parseFloat(avgWaitTimeCompute.toFixed(1)),
        avgWaitTimeGpu: parseFloat(avgWaitTimeGpu.toFixed(1)),
        maxWaitTime: parseFloat(maxWaitTime.toFixed(1)),
      });
    } catch (error) {
      console.error("Error fetching queue time data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on initial render
  useEffect(() => {
    fetchQueueTimeData();

    // Set up refresh interval
    const interval = setInterval(fetchQueueTimeData, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Format minutes as hours and minutes
  const formatMinutes = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes.toFixed(0)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-2">Queue Wait Times</h2>
          <p className="text-sm text-muted-foreground">
            Analysis of job wait times by partition and QoS
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchQueueTimeData}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{summaryStats.totalJobs}</div>
            <p className="text-sm text-muted-foreground">Jobs Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatMinutes(summaryStats.avgWaitTimeAll)}
            </div>
            <p className="text-sm text-muted-foreground">
              Avg Wait Time (All Jobs)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatMinutes(summaryStats.avgWaitTimeGpu)}
            </div>
            <p className="text-sm text-muted-foreground">
              Avg Wait Time (GPU Jobs)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatMinutes(summaryStats.maxWaitTime)}
            </div>
            <p className="text-sm text-muted-foreground">Max Wait Time</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Time Trends</TabsTrigger>
          <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Main Visualizations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wait Time by Partition */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Wait Time by Partition
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={Object.entries(
                      queueTimeData.reduce((acc, item) => {
                        if (!acc[item.partition]) {
                          acc[item.partition] = {
                            partition: item.partition,
                            waitTime: 0,
                            jobCount: 0,
                          };
                        }
                        acc[item.partition].waitTime +=
                          item.waitTime * item.jobCount;
                        acc[item.partition].jobCount += item.jobCount;
                        return acc;
                      }, {} as Record<string, any>)
                    ).map(([partition, data]) => ({
                      partition,
                      waitTime: parseFloat(
                        (data.waitTime / data.jobCount).toFixed(1)
                      ),
                      jobCount: data.jobCount,
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="partition" />
                    <YAxis
                      label={{
                        value: "Wait Time (minutes)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "waitTime")
                          return formatMinutes(value as number);
                        if (name === "jobCount") return value;
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="waitTime"
                      name="Avg Wait Time"
                      fill="#2563eb"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Wait Time by QoS */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Wait Time by QoS</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={Object.entries(
                      queueTimeData.reduce((acc, item) => {
                        if (!acc[item.qos]) {
                          acc[item.qos] = {
                            qos: item.qos,
                            waitTime: 0,
                            jobCount: 0,
                          };
                        }
                        acc[item.qos].waitTime += item.waitTime * item.jobCount;
                        acc[item.qos].jobCount += item.jobCount;
                        return acc;
                      }, {} as Record<string, any>)
                    ).map(([qos, data]) => ({
                      qos,
                      waitTime: parseFloat(
                        (data.waitTime / data.jobCount).toFixed(1)
                      ),
                      jobCount: data.jobCount,
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="qos" />
                    <YAxis
                      label={{
                        value: "Wait Time (minutes)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "waitTime")
                          return formatMinutes(value as number);
                        if (name === "jobCount") return value;
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="waitTime"
                      name="Avg Wait Time"
                      fill="#7c3aed"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Alert for long wait times */}
          {(summaryStats.avgWaitTimeGpu > 120 ||
            summaryStats.maxWaitTime > 240) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Long Queue Times Detected</AlertTitle>
              <AlertDescription>
                Some jobs are experiencing unusually long queue times. The GPU
                partition currently has an average wait time of{" "}
                {formatMinutes(summaryStats.avgWaitTimeGpu)}.
              </AlertDescription>
            </Alert>
          )}

          {/* Heat map table of wait times */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">
                Wait Time Matrix (minutes)
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partition / QoS</TableHead>
                    <TableHead>High</TableHead>
                    <TableHead>Normal</TableHead>
                    <TableHead>Low</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["compute", "gpu", "interactive"].map((partition) => {
                    const partitionData = queueTimeData.filter(
                      (item) => item.partition === partition
                    );
                    return (
                      <TableRow key={partition}>
                        <TableCell className="font-medium capitalize">
                          {partition}
                        </TableCell>
                        {["high", "normal", "low"].map((qos) => {
                          const item = partitionData.find(
                            (item) => item.qos === qos
                          );
                          const waitTime = item ? item.waitTime : 0;

                          // Determine background color based on wait time
                          let bgColor = "bg-green-50 dark:bg-green-950/20";
                          if (waitTime > 120)
                            bgColor = "bg-red-50 dark:bg-red-950/20";
                          else if (waitTime > 60)
                            bgColor = "bg-yellow-50 dark:bg-yellow-950/20";

                          return (
                            <TableCell key={qos} className={bgColor}>
                              {formatMinutes(waitTime)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Wait Time Trends */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">
                Wait Time Trends (24h)
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={waitTimeTrends}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis
                    label={{
                      value: "Wait Time (minutes)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value) => formatMinutes(value as number)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="compute"
                    name="Compute Partition"
                    stroke={partitionColors.compute}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="gpu"
                    name="GPU Partition"
                    stroke={partitionColors.gpu}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="interactive"
                    name="Interactive Partition"
                    stroke={partitionColors.interactive}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Note: This chart shows how wait times vary throughout the day
                for different partitions
              </div>
            </CardContent>
          </Card>

          {/* Area Chart */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">
                Cumulative Wait Time Distribution
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={waitTimeTrends}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatMinutes(value as number)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="interactive"
                    name="Interactive Partition"
                    stackId="1"
                    stroke={partitionColors.interactive}
                    fill={partitionColors.interactive}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="compute"
                    name="Compute Partition"
                    stackId="1"
                    stroke={partitionColors.compute}
                    fill={partitionColors.compute}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="gpu"
                    name="GPU Partition"
                    stackId="1"
                    stroke={partitionColors.gpu}
                    fill={partitionColors.gpu}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Stacked area chart showing the distribution of wait times across
                partitions
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Detailed analysis of all queue times */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">
                Detailed Queue Time Analysis
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partition</TableHead>
                    <TableHead>QoS</TableHead>
                    <TableHead>Avg Wait Time</TableHead>
                    <TableHead>Job Count</TableHead>
                    <TableHead>Wait Time Distribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueTimeData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium capitalize">
                        {item.partition}
                      </TableCell>
                      <TableCell className="capitalize">{item.qos}</TableCell>
                      <TableCell>{formatMinutes(item.waitTime)}</TableCell>
                      <TableCell>{item.jobCount}</TableCell>
                      <TableCell>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              item.partition === "gpu"
                                ? "bg-purple-500"
                                : item.partition === "compute"
                                ? "bg-blue-500"
                                : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (item.waitTime / summaryStats.maxWaitTime) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recommendations based on queue times */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Recommendations</h3>
              <div className="space-y-4">
                {summaryStats.avgWaitTimeGpu > 120 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>High GPU Queue Times</AlertTitle>
                    <AlertDescription>
                      Consider using high QoS for critical GPU jobs. Current
                      average wait time for GPU jobs is{" "}
                      {formatMinutes(summaryStats.avgWaitTimeGpu)}.
                    </AlertDescription>
                  </Alert>
                )}

                {queueTimeData.find(
                  (item) =>
                    item.partition === "interactive" && item.waitTime > 30
                ) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Interactive Session Delays</AlertTitle>
                    <AlertDescription>
                      Interactive jobs are experiencing longer than expected
                      queue times. Consider adjusting the interactive partition
                      settings.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert variant="default">
                  <AlertTitle>Optimal Submission Times</AlertTitle>
                  <AlertDescription>
                    Based on the 24-hour trend analysis, the best time to submit
                    jobs is between 8:00 PM and 6:00 AM when queue times are
                    typically 30-40% lower.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QueueTimesReport;
