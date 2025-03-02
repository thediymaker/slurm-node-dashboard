"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Tooltip, Cell } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
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
import { cn } from "@/lib/utils";

// ===== Type Definitions =====
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

type SortableKey = "avgUtilization" | "gpuCount" | "duration";

interface GpuUtilizationReportProps {
  data?: any;
}

// ===== Constants =====
const COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777"];
const UNDERUTILIZATION_THRESHOLD = 30; // Below 30% is considered underutilized

// ===== Subcomponents =====

// Summary stats cards at the top
const SummaryStatsCards = ({
  summaryStats,
  precalcAverage,
}: {
  summaryStats: {
    totalJobs: number;
    underutilizedJobs: number;
    averageUtilization: number;
    wastedGpuHours: number;
  };
  precalcAverage: number | null;
}) => {
  return (
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
            {precalcAverage !== null
              ? precalcAverage
              : summaryStats.averageUtilization}
            %
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
  );
};

// Current average GPU utilization card
const CurrentUtilizationCard = ({
  timeSeriesData,
  precalcAverage,
  nodeUtilizationData,
}: {
  timeSeriesData: any[];
  precalcAverage: number | null;
  nodeUtilizationData: NodeGpuUtilization[];
}) => {
  const data = timeSeriesData[0];
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-medium mb-4">
          Current Average GPU Utilization
        </h3>
        {timeSeriesData.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-6xl font-bold text-primary">
              {precalcAverage !== null
                ? precalcAverage
                : data.averageUtilization}
              %
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Last updated: {data.timestamp}
            </div>
            <div className="text-xs text-muted-foreground mt-6">
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-w-full">
                Debug: Found{" "}
                {
                  nodeUtilizationData
                    .flatMap((node) => node.gpus)
                    .filter((gpu) => gpu.utilization > 0).length
                }{" "}
                active GPUs
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// GPU Utilization Distribution (PieChart)
const UtilizationDistributionChart = ({
  utilizationRanges,
}: {
  utilizationRanges: { name: string; value: number }[];
}) => {
  return (
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
  );
};

// Node-by-node GPU Utilization grid
const NodeUtilizationGrid = ({
  nodeUtilizationData,
}: {
  nodeUtilizationData: NodeGpuUtilization[];
}) => {
  return (
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
            else if (avgUtilization < 60) utilizationClass = "text-yellow-500";

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
  );
};

// ===== Underutilized Jobs Table (Sortable) =====
const UnderutilizedJobsTable = ({ jobs }: { jobs: GpuJobUtilization[] }) => {
  const [sortedJobs, setSortedJobs] = useState<GpuJobUtilization[]>([...jobs]);
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKey;
    direction: "ascending" | "descending";
  }>({
    key: "avgUtilization",
    direction: "ascending",
  });

  const requestSort = (key: SortableKey) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const sortableJobs = [...jobs];
    sortableJobs.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
    setSortedJobs(sortableJobs);
  }, [jobs, sortConfig]);

  const getSortDirectionIcon = (key: SortableKey) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  const SortableColumnHeader = ({
    column,
    label,
    className = "",
  }: {
    column: SortableKey;
    label: string;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        className="flex items-center justify-end w-full focus:outline-none"
        onClick={() => requestSort(column)}
      >
        {label}
        {getSortDirectionIcon(column)}
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>User</TableHead>
            <SortableColumnHeader
              column="avgUtilization"
              label="Utilization"
              className="text-right"
            />
            <SortableColumnHeader
              column="gpuCount"
              label="GPUs"
              className="text-right"
            />
            <SortableColumnHeader
              column="duration"
              label="Duration (hrs)"
              className="text-right"
            />
            <TableHead>Nodes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedJobs.map((job) => (
            <TableRow key={job.jobId}>
              <TableCell className="font-medium">{job.jobId}</TableCell>
              <TableCell>{job.user}</TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    job.avgUtilization < 10
                      ? "text-red-500 font-semibold"
                      : job.avgUtilization < 20
                      ? "text-amber-500"
                      : "text-amber-400"
                  )}
                >
                  {job.avgUtilization.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell className="text-right">{job.gpuCount}</TableCell>
              <TableCell className="text-right">
                {job.duration > 3600
                  ? (job.duration / 3600).toFixed(1)
                  : (job.duration / 60).toFixed(1)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {job.nodeNames.join(", ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ===== Main Component =====
const GpuUtilizationReport: React.FC<GpuUtilizationReportProps> = ({
  data,
}) => {
  // ===== State & Hooks =====
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

  // Precomputed metrics from Prometheus via your API
  const [precalcAverage, setPrecalcAverage] = useState<number | null>(null);
  const [precalcWasted, setPrecalcWasted] = useState<number | null>(null);
  const [precalcUnderutilized, setPrecalcUnderutilized] = useState<
    number | null
  >(null);

  // ===== API Calls & Data Processing =====

  const fetchPrecalcMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/reporting/gpu?job_id=489`);
      const result = await response.json();
      if (result.status === 200 && result.data) {
        setPrecalcAverage(result.data.averageUtilization);
        setPrecalcWasted(result.data.wastedGpuHours);
        setPrecalcUnderutilized(result.data.underutilizedCount);
      } else {
        setPrecalcAverage(null);
        setPrecalcWasted(null);
        setPrecalcUnderutilized(null);
      }
    } catch (error) {
      console.error("Error fetching precalculated GPU metrics:", error);
      setPrecalcAverage(null);
      setPrecalcWasted(null);
      setPrecalcUnderutilized(null);
    }
  }, []);

  const fetchNodesWithGpus = useCallback(async () => {
    try {
      const response = await fetch("/api/slurm/nodes");
      const data = await response.json();
      const gpuNodes = data.nodes.filter((node: any) => {
        const gresString = node.gres || node.GRES || "";
        return gresString.toLowerCase().includes("gpu");
      });
      return gpuNodes.map((node: any) => node.name);
    } catch (error) {
      console.error("Error fetching nodes with GPUs:", error);
      return [];
    }
  }, []);

  const fetchNodeGpuUtilization = useCallback(
    async (nodeName: string): Promise<NodeGpuUtilization | null> => {
      try {
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
        const jobsResponse = await fetch(`/api/slurm/jobs/node/${nodeName}`);
        const jobsData = await jobsResponse.json();
        const jobs = jobsData.jobs || [];
        const extractGpuUtilization = (gpu: any): number => {
          try {
            if (typeof gpu.utilization === "number") return gpu.utilization;
            if (
              !gpu.values ||
              !Array.isArray(gpu.values) ||
              gpu.values.length === 0
            )
              return 0;
            const firstValue = gpu.values[0];
            if (typeof firstValue === "number") return firstValue;
            if (Array.isArray(firstValue) && firstValue.length >= 2) {
              const value = firstValue[1];
              return typeof value === "string"
                ? parseFloat(value)
                : Number(value);
            }
            if (
              typeof firstValue === "object" &&
              firstValue !== null &&
              firstValue.value !== undefined
            ) {
              return typeof firstValue.value === "string"
                ? parseFloat(firstValue.value)
                : Number(firstValue.value);
            }
            if (firstValue && typeof firstValue === "object") {
              for (const key in firstValue) {
                if (
                  key.toLowerCase().includes("util") ||
                  key.toLowerCase().includes("value")
                ) {
                  const val = firstValue[key];
                  return typeof val === "string"
                    ? parseFloat(val)
                    : Number(val);
                }
              }
            }
          } catch (e) {
            console.error("Error extracting GPU utilization:", e);
          }
          return 0;
        };

        const processedGpus = gpuData.data.map((gpu: any) => {
          const utilization = extractGpuUtilization(gpu);
          return {
            gpu: String(gpu.gpu),
            modelName: gpu.modelName || "Unknown",
            utilization: isNaN(utilization) ? 0 : utilization,
            hpcJob: gpu.hpcJob,
          };
        });

        // Deduplicate GPUs by key (keeping the last occurrence)
        const uniqueGpusMap: Record<string, any> = {};
        for (let i = 0; i < processedGpus.length; i++) {
          const key = processedGpus[i].gpu;
          uniqueGpusMap[key] = processedGpus[i];
        }
        const uniqueGpus = Object.keys(uniqueGpusMap).map(
          (key) => uniqueGpusMap[key]
        );

        return { node: nodeName, gpus: uniqueGpus, jobs: jobs };
      } catch (error) {
        console.error(`Error fetching data for node ${nodeName}:`, error);
        return null;
      }
    },
    []
  );

  const processJobUtilization = useCallback(
    (nodeData: NodeGpuUtilization[]): GpuJobUtilization[] => {
      const jobMap = new Map<string, GpuJobUtilization>();
      nodeData.forEach((node) => {
        const validGpus = node.gpus.filter((gpu) => !isNaN(gpu.utilization));
        const totalUtilization = validGpus.reduce(
          (acc, gpu) => acc + gpu.utilization,
          0
        );
        const avgNodeUtilization =
          validGpus.length > 0 ? totalUtilization / validGpus.length : 0;
        node.jobs.forEach((job) => {
          const jobId = job.job_id;
          if (!jobMap.has(jobId)) {
            jobMap.set(jobId, {
              jobId,
              user: job.user,
              avgUtilization: avgNodeUtilization,
              gpuCount: job.gpus || 0,
              duration: job.time_used || 0,
              nodeNames: [node.node],
            });
          } else {
            const existingJob = jobMap.get(jobId)!;
            if (validGpus.length > 0) {
              const totalUtil =
                existingJob.avgUtilization * existingJob.nodeNames.length;
              const newAvgUtil =
                (totalUtil + avgNodeUtilization) /
                (existingJob.nodeNames.length + 1);
              existingJob.avgUtilization = newAvgUtil;
            }
            if (!existingJob.nodeNames.includes(node.node)) {
              existingJob.nodeNames.push(node.node);
            }
            jobMap.set(jobId, existingJob);
          }
        });
      });
      return Array.from(jobMap.values());
    },
    []
  );

  const generateTimeSeriesData = useCallback(
    (nodeData: NodeGpuUtilization[]): any[] => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const formattedTime = `${currentHour}:${
        currentMinute < 10 ? "0" + currentMinute : currentMinute
      }`;
      const validGpus = nodeData
        .flatMap((node) => node.gpus)
        .filter((gpu) => !isNaN(gpu.utilization));
      const totalUtilization = validGpus.reduce(
        (acc, gpu) => acc + gpu.utilization,
        0
      );
      const avgUtilization =
        validGpus.length > 0 ? totalUtilization / validGpus.length : 0;
      return [
        {
          timestamp: formattedTime,
          averageUtilization: Math.round(avgUtilization),
          isRealData: true,
        },
      ];
    },
    []
  );

  const calculateStats = useCallback(
    (jobData: GpuJobUtilization[]) => {
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
      const totalJobs = jobData.length;
      const underutilizedJobs = jobData.filter(
        (job) => job.avgUtilization < UNDERUTILIZATION_THRESHOLD
      ).length;
      const averageUtilization =
        totalJobs > 0
          ? jobData.reduce((acc, job) => acc + job.avgUtilization, 0) /
            totalJobs
          : 0;
      const wastedGpuHours = jobData.reduce((acc, job) => {
        const utilization = !isNaN(job.avgUtilization) ? job.avgUtilization : 0;
        const wastedFraction = (100 - utilization) / 100;
        const durationHours = !isNaN(job.duration)
          ? job.duration > 3600
            ? job.duration / 3600
            : job.duration / 60
          : 0;
        const gpuCount = !isNaN(job.gpuCount) ? job.gpuCount : 0;
        const wasted = wastedFraction * gpuCount * durationHours;
        return acc + wasted;
      }, 0);
      setUtilizationRanges(ranges);
      setSummaryStats({
        totalJobs,
        underutilizedJobs:
          precalcUnderutilized !== null
            ? precalcUnderutilized
            : underutilizedJobs,
        averageUtilization:
          precalcAverage !== null
            ? parseFloat(precalcAverage.toFixed(1))
            : parseFloat(averageUtilization.toFixed(1)),
        wastedGpuHours:
          precalcWasted !== null
            ? precalcWasted
            : !isNaN(wastedGpuHours) && wastedGpuHours > 0
            ? Math.round(wastedGpuHours)
            : 0,
      });
    },
    [precalcAverage, precalcUnderutilized, precalcWasted]
  );

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const gpuNodes = await fetchNodesWithGpus();
      setNodesWithGpus(gpuNodes);
      const nodeDataPromises = gpuNodes.map((node: string) =>
        fetchNodeGpuUtilization(node)
      );
      const nodeDataResults = await Promise.all(nodeDataPromises);
      const validNodeData = nodeDataResults.filter(
        (data): data is NodeGpuUtilization => data !== null
      );
      setNodeUtilizationData(validNodeData);
      const jobUtilization = processJobUtilization(validNodeData);
      setJobUtilizationData(jobUtilization);
      const timeData = generateTimeSeriesData(validNodeData);
      setTimeSeriesData(timeData);
      calculateStats(jobUtilization);
    } catch (error) {
      console.error("Error loading GPU utilization data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchNodesWithGpus,
    fetchNodeGpuUtilization,
    processJobUtilization,
    generateTimeSeriesData,
    calculateStats,
  ]);

  // ===== Effects =====
  useEffect(() => {
    const inspectPrometheusDcgmApi = async () => {
      try {
        const nodes = await fetchNodesWithGpus();
        if (nodes && nodes.length > 0) {
          const response = await fetch(
            `/api/prometheus/dcgm?node=${encodeURIComponent(nodes[0])}`
          );
          const data = await response.json();
        }
      } catch (error) {
        console.error("Error inspecting Prometheus API:", error);
      }
    };
    inspectPrometheusDcgmApi();
    loadAllData();
    fetchPrecalcMetrics();
  }, [loadAllData, fetchNodesWithGpus, fetchPrecalcMetrics]);

  useEffect(() => {
    if (timeSeriesData.length > 0) {
      setSummaryStats((prev) => ({
        ...prev,
        averageUtilization:
          precalcAverage !== null
            ? precalcAverage
            : timeSeriesData[0].averageUtilization || 0,
      }));
    }
  }, [timeSeriesData, precalcAverage]);

  const underutilizedJobs = jobUtilizationData
    .filter((job) => job.avgUtilization < UNDERUTILIZATION_THRESHOLD)
    .sort((a, b) => a.avgUtilization - b.avgUtilization);

  const handleRefresh = () => {
    loadAllData();
    fetchPrecalcMetrics();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
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

  // ===== Render Main UI =====
  return (
    <div className="space-y-6 w-full">
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
          onClick={handleRefresh}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <SummaryStatsCards
        summaryStats={summaryStats}
        precalcAverage={precalcAverage}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CurrentUtilizationCard
          timeSeriesData={timeSeriesData}
          precalcAverage={precalcAverage}
          nodeUtilizationData={nodeUtilizationData}
        />
        <UtilizationDistributionChart utilizationRanges={utilizationRanges} />
      </div>

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

      <NodeUtilizationGrid nodeUtilizationData={nodeUtilizationData} />

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Underutilized Jobs</h3>
          {underutilizedJobs.length > 0 ? (
            <UnderutilizedJobsTable jobs={underutilizedJobs} />
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
