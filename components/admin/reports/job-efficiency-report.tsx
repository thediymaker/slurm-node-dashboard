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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface JobEfficiencyReportProps {
  data?: any;
}

interface JobEfficiencyData {
  jobId: string;
  user: string;
  cpuUtilization: number;
  memoryUtilization: number;
  allocatedCores: number;
  allocatedMemory: number;
  runtime: number;
  partition: string;
  qos: string;
}

const JobEfficiencyReport: React.FC<JobEfficiencyReportProps> = ({ data }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [jobEfficiencyData, setJobEfficiencyData] = useState<
    JobEfficiencyData[]
  >([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalJobs: 0,
    avgCpuEfficiency: 0,
    avgMemEfficiency: 0,
    inefficientCpuJobs: 0,
    inefficientMemJobs: 0,
  });

  // Function to fetch job efficiency data
  const fetchJobEfficiencyData = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch data from your Prometheus/InfluxDB
      // For this prototype, we'll generate mock data
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API delay

      // Generate mock data
      const mockJobs = Array.from({ length: 20 }, (_, i) => {
        const cpuUtil = Math.random() * 80 + 10; // 10-90%
        const memUtil = Math.random() * 80 + 10; // 10-90%

        return {
          jobId: `job-${1000000 + i}`,
          user: `user${i % 8}`,
          cpuUtilization: parseFloat(cpuUtil.toFixed(1)),
          memoryUtilization: parseFloat(memUtil.toFixed(1)),
          allocatedCores: Math.floor(Math.random() * 24) + 1,
          allocatedMemory: Math.floor(Math.random() * 128) + 8, // GB
          runtime: Math.floor(Math.random() * 72) + 1, // hours
          partition: ["compute", "gpu", "interactive"][
            Math.floor(Math.random() * 3)
          ],
          qos: ["normal", "high", "low"][Math.floor(Math.random() * 3)],
        };
      });

      setJobEfficiencyData(mockJobs);

      // Generate time series data (mock)
      const currentHour = new Date().getHours();
      const timePoints = Array.from({ length: 24 }, (_, i) => {
        const hour = (currentHour - 23 + i + 24) % 24; // Go back 23 hours and wrap around
        return `${hour}:00`;
      });

      const timeData = timePoints.map((time) => {
        return {
          timestamp: time,
          avgCpuEfficiency: parseFloat((Math.random() * 40 + 30).toFixed(1)), // 30-70%
          avgMemEfficiency: parseFloat((Math.random() * 40 + 40).toFixed(1)), // 40-80%
        };
      });

      setTimeSeriesData(timeData);

      // Calculate summary statistics
      const totalJobs = mockJobs.length;
      const avgCpuEfficiency =
        mockJobs.reduce((acc, job) => acc + job.cpuUtilization, 0) / totalJobs;
      const avgMemEfficiency =
        mockJobs.reduce((acc, job) => acc + job.memoryUtilization, 0) /
        totalJobs;
      const inefficientCpuJobs = mockJobs.filter(
        (job) => job.cpuUtilization < 30
      ).length;
      const inefficientMemJobs = mockJobs.filter(
        (job) => job.memoryUtilization < 30
      ).length;

      setSummaryStats({
        totalJobs,
        avgCpuEfficiency: parseFloat(avgCpuEfficiency.toFixed(1)),
        avgMemEfficiency: parseFloat(avgMemEfficiency.toFixed(1)),
        inefficientCpuJobs,
        inefficientMemJobs,
      });
    } catch (error) {
      console.error("Error fetching job efficiency data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on initial render
  useEffect(() => {
    fetchJobEfficiencyData();

    // Set up refresh interval
    const interval = setInterval(fetchJobEfficiencyData, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
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

  // Find least efficient jobs
  const inefficientJobs = jobEfficiencyData
    .sort((a, b) => a.cpuUtilization - b.cpuUtilization)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-2">Job Efficiency Report</h2>
          <p className="text-sm text-muted-foreground">
            CPU and memory utilization across running jobs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchJobEfficiencyData}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{summaryStats.totalJobs}</div>
            <p className="text-sm text-muted-foreground">Active Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.avgCpuEfficiency}%
            </div>
            <p className="text-sm text-muted-foreground">Avg CPU Efficiency</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.avgMemEfficiency}%
            </div>
            <p className="text-sm text-muted-foreground">
              Avg Memory Efficiency
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.inefficientCpuJobs}
            </div>
            <p className="text-sm text-muted-foreground">
              Low CPU Efficiency Jobs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.inefficientMemJobs}
            </div>
            <p className="text-sm text-muted-foreground">
              Low Memory Efficiency Jobs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Efficiency Over Time */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">
              Resource Efficiency (24h)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={timeSeriesData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgCpuEfficiency"
                  stroke="#2563eb"
                  name="CPU Efficiency"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="avgMemEfficiency"
                  stroke="#7c3aed"
                  name="Memory Efficiency"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Note: This chart shows average efficiency across all jobs over
              time
            </div>
          </CardContent>
        </Card>

        {/* CPU vs Memory Efficiency Scatter */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">
              CPU vs Memory Efficiency
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="cpuUtilization"
                  name="CPU Efficiency"
                  unit="%"
                  domain={[0, 100]}
                />
                <YAxis
                  type="number"
                  dataKey="memoryUtilization"
                  name="Memory Efficiency"
                  unit="%"
                  domain={[0, 100]}
                />
                <ZAxis
                  type="number"
                  dataKey="allocatedCores"
                  range={[50, 300]}
                  name="Allocated Cores"
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value, name) => [`${value}%`, name]}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background p-2 border rounded-md shadow-sm">
                          <p className="font-medium">{`Job: ${data.jobId}`}</p>
                          <p>{`User: ${data.user}`}</p>
                          <p>{`CPU Efficiency: ${data.cpuUtilization}%`}</p>
                          <p>{`Memory Efficiency: ${data.memoryUtilization}%`}</p>
                          <p>{`Allocated Cores: ${data.allocatedCores}`}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Scatter name="Jobs" data={jobEfficiencyData} fill="#2563eb" />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Bubble size represents the number of allocated CPU cores
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Efficiency Jobs Alert */}
      {inefficientJobs.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low Efficiency Jobs Detected</AlertTitle>
          <AlertDescription>
            {inefficientJobs.length} jobs have CPU efficiency below 30%. These
            jobs may be wasting cluster resources.
          </AlertDescription>
        </Alert>
      )}

      {/* Resource Efficiency by Partition */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">
            Resource Efficiency by Partition
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                {
                  partition: "compute",
                  cpuEfficiency: 45.3,
                  memoryEfficiency: 58.1,
                },
                {
                  partition: "gpu",
                  cpuEfficiency: 37.8,
                  memoryEfficiency: 62.4,
                },
                {
                  partition: "interactive",
                  cpuEfficiency: 52.1,
                  memoryEfficiency: 43.7,
                },
              ]}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="partition" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar
                dataKey="cpuEfficiency"
                name="CPU Efficiency"
                fill="#2563eb"
              />
              <Bar
                dataKey="memoryEfficiency"
                name="Memory Efficiency"
                fill="#7c3aed"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Least Efficient Jobs</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Partition</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>CPU Efficiency</TableHead>
                <TableHead>Memory Efficiency</TableHead>
                <TableHead>Runtime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobEfficiencyData
                .sort((a, b) => {
                  // Sort by the average of CPU and memory efficiency
                  const avgA = (a.cpuUtilization + a.memoryUtilization) / 2;
                  const avgB = (b.cpuUtilization + b.memoryUtilization) / 2;
                  return avgA - avgB;
                })
                .slice(0, 10)
                .map((job) => (
                  <TableRow key={job.jobId}>
                    <TableCell className="font-medium">{job.jobId}</TableCell>
                    <TableCell>{job.user}</TableCell>
                    <TableCell>{job.partition}</TableCell>
                    <TableCell>{job.allocatedCores} cores</TableCell>
                    <TableCell>{job.allocatedMemory} GB</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span
                          className={
                            job.cpuUtilization < 30
                              ? "text-red-500"
                              : job.cpuUtilization < 60
                              ? "text-yellow-500"
                              : "text-green-500"
                          }
                        >
                          {job.cpuUtilization}%
                        </span>
                        <div className="ml-2 h-1.5 w-16 bg-secondary rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${
                              job.cpuUtilization < 30
                                ? "bg-red-500"
                                : job.cpuUtilization < 60
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${job.cpuUtilization}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span
                          className={
                            job.memoryUtilization < 30
                              ? "text-red-500"
                              : job.memoryUtilization < 60
                              ? "text-yellow-500"
                              : "text-green-500"
                          }
                        >
                          {job.memoryUtilization}%
                        </span>
                        <div className="ml-2 h-1.5 w-16 bg-secondary rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${
                              job.memoryUtilization < 30
                                ? "bg-red-500"
                                : job.memoryUtilization < 60
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${job.memoryUtilization}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{job.runtime} hrs</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default JobEfficiencyReport;
