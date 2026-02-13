"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { jobMetricsPluginMetadata, gpuUtilizationPluginMetadata } from "@/actions/plugins";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Gauge,
  Cpu,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface GPUJob {
  jobId: string;
  userName?: string;
  account?: string;
  avgUtilization: number;
  gpuCount: number;
  isUnderutilized: boolean;
  nodeNames?: string[];
  gpuModel?: string;
}

interface GPUReportResponse {
  status: number;
  data?: {
    systemMetrics: {
      averageUtilization: number;
      underutilizedJobCount: number;
      totalWastedGpuHours: number;
      totalJobs: number;
    };
    jobs: GPUJob[];
  };
  message?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SortKey = "jobId" | "userName" | "avgUtilization" | "gpuCount";
type SortDirection = "asc" | "desc";

export function GPUAnalysisPanel() {
  if (!jobMetricsPluginMetadata.isEnabled || !gpuUtilizationPluginMetadata.isEnabled) {
    return null;
  }

  const { data, error, isLoading, mutate } = useSWR<GPUReportResponse>(
    "/api/gpu/report?timeRange=24h",
    fetcher,
    { refreshInterval: 60000 }
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("avgUtilization");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showOnlyUnderutilized, setShowOnlyUnderutilized] = useState(false);

  const processedJobs = useMemo(() => {
    if (!data?.data?.jobs) return [];

    let jobs = [...data.data.jobs];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.jobId.toLowerCase().includes(search) ||
          j.userName?.toLowerCase().includes(search) ||
          j.account?.toLowerCase().includes(search)
      );
    }

    if (showOnlyUnderutilized) {
      jobs = jobs.filter((j) => j.isUnderutilized);
    }

    jobs.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortKey) {
        case "jobId":
          aVal = parseInt(a.jobId) || 0;
          bVal = parseInt(b.jobId) || 0;
          break;
        case "userName":
          aVal = a.userName || "";
          bVal = b.userName || "";
          break;
        case "avgUtilization":
          aVal = a.avgUtilization;
          bVal = b.avgUtilization;
          break;
        case "gpuCount":
          aVal = a.gpuCount;
          bVal = b.gpuCount;
          break;
        default:
          return 0;
      }

      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return jobs;
  }, [data, searchTerm, sortKey, sortDirection, showOnlyUnderutilized]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const getUtilizationColor = (util: number) => {
    if (util >= 70) return "text-emerald-900";
    if (util >= 40) return "text-amber-900";
    return "text-red-900";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || data?.status !== 200) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            GPU Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {data?.message || "Failed to load GPU metrics"}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Ensure Prometheus is configured and DCGM metrics are available.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = data.data!.systemMetrics;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active GPU Jobs</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalJobs}</div>
            <p className="text-xs text-muted-foreground">Jobs currently using GPUs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getUtilizationColor(metrics.averageUtilization)}`}>
              {metrics.averageUtilization.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Cluster-wide average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Underutilized Jobs</CardTitle>
            <AlertTriangle className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.underutilizedJobCount > 0 ? "text-amber-900" : "text-emerald-900"}`}>
              {metrics.underutilizedJobCount}
            </div>
            <p className="text-xs text-muted-foreground">Jobs below 30% utilization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wasted GPU Hours</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalWastedGpuHours.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Estimated unused capacity</p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-medium flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                GPU Job Analysis
              </CardTitle>
              <CardDescription>
                {processedJobs.length} job{processedJobs.length !== 1 ? "s" : ""} shown
                {showOnlyUnderutilized && " (underutilized only)"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search jobs, users..."
                  className="pl-8 w-[200px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={showOnlyUnderutilized}
                    onCheckedChange={setShowOnlyUnderutilized}
                  >
                    Show only underutilized (&lt;30%)
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="icon" onClick={() => mutate()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {processedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchTerm || showOnlyUnderutilized
                ? "No jobs match your filters"
                : "No GPU jobs currently running"}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("jobId")}>
                      <div className="flex items-center">
                        Job ID
                        <SortIcon columnKey="jobId" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("userName")}>
                      <div className="flex items-center">
                        User
                        <SortIcon columnKey="userName" />
                      </div>
                    </TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("gpuCount")}>
                      <div className="flex items-center">
                        GPUs
                        <SortIcon columnKey="gpuCount" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("avgUtilization")}>
                      <div className="flex items-center">
                        Avg Util
                        <SortIcon columnKey="avgUtilization" />
                      </div>
                    </TableHead>
                    <TableHead>Nodes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedJobs.map((job) => (
                    <TableRow key={job.jobId}>
                      <TableCell className="font-medium font-mono">{job.jobId}</TableCell>
                      <TableCell>{job.userName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{job.account || "—"}</TableCell>
                      <TableCell>{job.gpuCount}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${getUtilizationColor(job.avgUtilization)}`}>
                          {job.avgUtilization.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {job.nodeNames?.join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        {job.isUnderutilized ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Low
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-500">
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
