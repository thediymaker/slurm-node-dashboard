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
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Define types for job and node data
interface JobData {
  job_id: string;
  user: string;
  account: string;
  gpus: number;
  nodes: string[];
  state: string;
  time_limit: number;
  time_used: number;
}

interface NodeGpuUtilization {
  node: string;
  gpus: Array<{
    gpu: string;
    modelName: string;
    utilization: number;
  }>;
  jobs: JobData[];
}

interface GpuJobUtilization {
  jobId: string;
  jobName?: string;
  user: string;
  avgUtilization: number;
  gpuCount: number;
  duration: number;
  nodeNames: string[];
}

interface GpuUtilizationReportProps {
  data?: any;
}

const COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777"];
const UNDERUTILIZATION_THRESHOLD = 30; // Below 30% is considered underutilized

const GpuUtilizationReport: React.FC<GpuUtilizationReportProps> = ({
  data,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [nodesWithGpus, setNodesWithGpus] = useState<string[]>([]);
  const [nodeUtilizationData, setNodeUtilizationData] = useState<
    NodeGpuUtilization[]
  >([]);
  const [jobUtilizationData, setJobUtilizationData] = useState<
    GpuJobUtilization[]
  >([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [utilizationRanges, setUtilizationRanges] = useState([
    { name: "0-20%", value: 0 },
    { name: "21-40%", value: 0 },
    { name: "41-60%", value: 0 },
    { name: "61-80%", value: 0 },
    { name: "81-100%", value: 0 },
  ]);
  const [summaryStats, setSummaryStats] = useState({
    totalJobs: 0,
    underutilizedJobs: 0,
    averageUtilization: 0,
    wastedGpuHours: 0,
  });

  // Function to fetch all nodes with GPUs
  const fetchNodesWithGpus = async () => {
    try {
      const response = await fetch("/api/slurm/nodes");
      const data = await response.json();

      // Filter nodes that have GPUs (looking for GRES or gres field that contains "gpu")
      const gpuNodes = data.nodes.filter((node: any) => {
        const gresString = node.gres || node.GRES || "";
        return gresString.toLowerCase().includes("gpu");
      });

      return gpuNodes.map((node: any) => node.name);
    } catch (error) {
      console.error("Error fetching nodes with GPUs:", error);
      return [];
    }
  };

  // Function to fetch GPU utilization data for a specific node
  const fetchNodeGpuUtilization = async (
    nodeName: string
  ): Promise<NodeGpuUtilization | null> => {
    try {
      // Fetch GPU utilization from Prometheus
      const gpuResponse = await fetch(
        `/api/prometheus/dcgm?node=${encodeURIComponent(nodeName)}`
      );
      const gpuData = await gpuResponse.json();

      if (
        gpuData.status !== 200 ||
        !gpuData.data ||
        gpuData.data.length === 0
      ) {
        return null;
      }

      // Fetch jobs running on this node
      const jobsResponse = await fetch(`/api/slurm/jobs/node/${nodeName}`);
      const jobsData = await jobsResponse.json();

      const jobs = jobsData.jobs || [];

      return {
        node: nodeName,
        gpus: gpuData.data,
        jobs: jobs,
      };
    } catch (error) {
      console.error(`Error fetching data for node ${nodeName}:`, error);
      return null;
    }
  };

  // Function to combine GPU utilization and job data to get job-level GPU utilization
  const processJobUtilization = (
    nodeData: NodeGpuUtilization[]
  ): GpuJobUtilization[] => {
    const jobMap = new Map<string, GpuJobUtilization>();

    // Process each node's data
    nodeData.forEach((node) => {
      // Get average GPU utilization for this node
      const totalUtilization = node.gpus.reduce(
        (acc, gpu) => acc + gpu.utilization,
        0
      );
      const avgNodeUtilization =
        node.gpus.length > 0 ? totalUtilization / node.gpus.length : 0;

      // Process each job running on this node
      node.jobs.forEach((job) => {
        const jobId = job.job_id;

        if (!jobMap.has(jobId)) {
          // First time seeing this job
          jobMap.set(jobId, {
            jobId,
            user: job.user,
            avgUtilization: avgNodeUtilization,
            gpuCount: job.gpus || 0,
            duration: job.time_used || 0,
            nodeNames: [node.node],
          });
        } else {
          // Update existing job data
          const existingJob = jobMap.get(jobId)!;

          // Only update utilization if we have GPU data
          if (node.gpus.length > 0) {
            const totalUtil =
              existingJob.avgUtilization * existingJob.nodeNames.length;
            const newAvgUtil =
              (totalUtil + avgNodeUtilization) /
              (existingJob.nodeNames.length + 1);
            existingJob.avgUtilization = newAvgUtil;
          }

          // Add this node to the list of nodes for this job
          if (!existingJob.nodeNames.includes(node.node)) {
            existingJob.nodeNames.push(node.node);
          }

          // Update job with new values
          jobMap.set(jobId, existingJob);
        }
      });
    });

    return Array.from(jobMap.values());
  };

  // Function to generate time series data from node utilization
  const generateTimeSeriesData = (nodeData: NodeGpuUtilization[]): any[] => {
    // For MVP, we'll create data points for the current time only
    // In a full implementation, we would fetch historical data from Prometheus
    const currentHour = new Date().getHours();

    const timePoints = Array.from({ length: 24 }, (_, i) => {
      const hour = (currentHour - 23 + i + 24) % 24; // Go back 23 hours and wrap around
      return `${hour}:00`;
    });

    // Calculate average utilization across all nodes for current time
    const currentUtilization = nodeData
      .flatMap((node) => node.gpus)
      .reduce((acc, gpu) => {
        return acc + gpu.utilization;
      }, 0);

    const avgUtilization =
      nodeData.flatMap((node) => node.gpus).length > 0
        ? currentUtilization / nodeData.flatMap((node) => node.gpus).length
        : 0;

    // Generate mock data for previous hours (would be real data in production)
    return timePoints.map((time, index) => {
      // Only the last point is real data, others are simulated for demo
      const isRealData = index === timePoints.length - 1;

      // For simulated data, create a reasonable pattern with some randomness
      let utilization;
      if (isRealData) {
        utilization = avgUtilization;
      } else {
        // Create a sine wave pattern with random noise
        const baseValue = 50 + 30 * Math.sin((index / 24) * Math.PI * 2);
        const noise = Math.random() * 15 - 7.5;
        utilization = Math.max(0, Math.min(100, baseValue + noise));
      }

      return {
        timestamp: time,
        averageUtilization: Math.round(utilization),
        isRealData,
      };
    });
  };

  // Function to calculate utilization ranges and summary statistics
  const calculateStats = (jobData: GpuJobUtilization[]) => {
    // Calculate utilization ranges
    const ranges = [
      { name: "0-20%", value: 0 },
      { name: "21-40%", value: 0 },
      { name: "41-60%", value: 0 },
      { name: "61-80%", value: 0 },
      { name: "81-100%", value: 0 },
    ];

    jobData.forEach((job) => {
      if (job.avgUtilization <= 20) ranges[0].value++;
      else if (job.avgUtilization <= 40) ranges[1].value++;
      else if (job.avgUtilization <= 60) ranges[2].value++;
      else if (job.avgUtilization <= 80) ranges[3].value++;
      else ranges[4].value++;
    });

    // Calculate summary statistics
    const totalJobs = jobData.length;
    const underutilizedJobs = jobData.filter(
      (job) => job.avgUtilization < UNDERUTILIZATION_THRESHOLD
    ).length;
    const averageUtilization =
      totalJobs > 0
        ? jobData.reduce((acc, job) => acc + job.avgUtilization, 0) / totalJobs
        : 0;

    // Calculate wasted GPU hours (assuming low utilization = wasted resources)
    const wastedGpuHours = jobData.reduce((acc, job) => {
      const utilization = job.avgUtilization / 100;
      const wastedFraction = 1 - utilization;
      // Convert job duration to hours (assuming it's in minutes)
      const durationHours = job.duration / 60;
      return acc + wastedFraction * job.gpuCount * durationHours;
    }, 0);

    setUtilizationRanges(ranges);
    setSummaryStats({
      totalJobs,
      underutilizedJobs,
      averageUtilization: parseFloat(averageUtilization.toFixed(1)),
      wastedGpuHours: Math.round(wastedGpuHours),
    });
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Get all nodes with GPUs
      const gpuNodes = await fetchNodesWithGpus();
      setNodesWithGpus(gpuNodes);

      // 2. Fetch data for each node
      const nodeDataPromises = gpuNodes.map((node: any) =>
        fetchNodeGpuUtilization(node)
      );
      const nodeDataResults = await Promise.all(nodeDataPromises);

      // 3. Filter out null results
      const validNodeData = nodeDataResults.filter(
        (data): data is NodeGpuUtilization => data !== null
      );
      setNodeUtilizationData(validNodeData);

      // 4. Process job utilization data
      const jobUtilization = processJobUtilization(validNodeData);
      setJobUtilizationData(jobUtilization);

      // 5. Generate time series data
      const timeData = generateTimeSeriesData(validNodeData);
      setTimeSeriesData(timeData);

      // 6. Calculate statistics
      calculateStats(jobUtilization);
    } catch (error) {
      console.error("Error loading GPU utilization data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on initial render
  useEffect(() => {
    loadAllData();

    // Set up refresh interval
    const interval = setInterval(loadAllData, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Find most underutilized jobs
  const underutilizedJobs = jobUtilizationData
    .filter((job) => job.avgUtilization < UNDERUTILIZATION_THRESHOLD)
    .sort((a, b) => a.avgUtilization - b.avgUtilization)
    .slice(0, 5);

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
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-2">
            GPU Utilization Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitoring {nodesWithGpus.length} nodes with{" "}
            {jobUtilizationData.length} GPU jobs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadAllData}
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
            <p className="text-sm text-muted-foreground">GPU Jobs Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.underutilizedJobs}
            </div>
            <p className="text-sm text-muted-foreground">Underutilized Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.averageUtilization}%
            </div>
            <p className="text-sm text-muted-foreground">Avg GPU Utilization</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {summaryStats.wastedGpuHours}
            </div>
            <p className="text-sm text-muted-foreground">Wasted GPU Hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Average GPU Utilization Over Time */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">
              Average GPU Utilization (24h)
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
                  dataKey="averageUtilization"
                  stroke="#2563eb"
                  name="GPU Utilization"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.isRealData) {
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#2563eb"
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }
                    return <circle cx={cx} cy={cy} r={3} fill="#94a3b8" />;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Note: Only the most recent data point represents real-time data.
              Historical data is simulated.
            </div>
          </CardContent>
        </Card>

        {/* Distribution of GPU Utilization */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">
              GPU Utilization Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={utilizationRanges}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ""
                  }
                >
                  {utilizationRanges.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} jobs`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Underutilized Jobs Alert */}
      {underutilizedJobs.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Underutilized GPU Jobs Detected</AlertTitle>
          <AlertDescription>
            {underutilizedJobs.length} jobs were found with GPU utilization
            below {UNDERUTILIZATION_THRESHOLD}%. This may indicate inefficient
            resource usage or jobs that are waiting for data/processing.
          </AlertDescription>
        </Alert>
      )}

      {/* Node-by-Node GPU Utilization */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Node GPU Utilization</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {nodeUtilizationData.map((node) => {
              const avgUtilization =
                node.gpus.length > 0
                  ? node.gpus.reduce((acc, gpu) => acc + gpu.utilization, 0) /
                    node.gpus.length
                  : 0;

              let utilizationClass = "text-green-500";
              if (avgUtilization < 30) utilizationClass = "text-red-500";
              else if (avgUtilization < 60)
                utilizationClass = "text-yellow-500";

              return (
                <Card key={node.node} className="bg-muted/20">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{node.node}</h4>
                        <p className="text-xs text-muted-foreground">
                          {node.gpus.length} GPUs, {node.jobs.length} Jobs
                        </p>
                      </div>
                      <div
                        className={`text-lg font-semibold ${utilizationClass}`}
                      >
                        {avgUtilization.toFixed(1)}%
                      </div>
                    </div>

                    {node.gpus.map((gpu, i) => (
                      <div key={i} className="mt-2">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span>
                            GPU {gpu.gpu} ({gpu.modelName})
                          </span>
                          <span>{gpu.utilization.toFixed(1)}%</span>
                        </div>
                        <div className="h-1 w-full bg-secondary rounded-full">
                          <div
                            className="h-1 bg-primary rounded-full"
                            style={{ width: `${gpu.utilization}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {node.jobs.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <div className="text-xs font-medium mb-1">
                          Running Jobs:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {node.jobs.map((job) => (
                            <Badge key={job.job_id} variant="secondary">
                              {job.job_id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Underutilized Jobs */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Most Underutilized Jobs</h3>
          {underutilizedJobs.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={underutilizedJobs}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jobId" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: any, name) => {
                    if (name === "avgUtilization") return `${value}%`;
                    if (name === "duration")
                      return `${(value / 60).toFixed(1)} hours`;
                    if (name === "gpuCount") return `${value} GPUs`;
                    return value;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="avgUtilization"
                  name="GPU Utilization"
                  fill="#ef4444"
                />
                <Bar dataKey="gpuCount" name="GPU Count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 bg-muted/20 rounded-md">
              <p className="text-muted-foreground">
                No underutilized jobs detected.
              </p>
            </div>
          )}
          <div className="mt-4 text-sm text-muted-foreground">
            * Showing jobs with utilization below {UNDERUTILIZATION_THRESHOLD}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GpuUtilizationReport;
