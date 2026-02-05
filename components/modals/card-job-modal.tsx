import { useState, useCallback, useMemo, memo } from "react";
import useSWR from "swr";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";
import { Job, JobDetails, NodeCardModalProps } from "@/types/types";
import { NodeMetricsPanel } from "../nodeCard/node-metrics-panel";
import PromComboBox from "../prom-metric";
import NodeUtilization from "../node-utilization";
import { JobGPUStats } from "@/components/job-gpu-stats";

// Utility function moved outside component - created once
const convertUnixToHumanReadable = (unixTimestamp: number): string => {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString();
};

const formatRelativeTime = (unixTimestamp: number): string => {
  const now = Date.now();
  const diff = now - unixTimestamp * 1000;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}m ago`;
};

// Generic JSON fetcher for SWR - stable reference
const jsonFetcher = (url: string) =>
  fetch(url, {
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());

const SkeletonJobCard = () => (
  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-20" />
    </div>
    <div className="flex gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-24" />
    </div>
  </div>
);

const SkeletonJobDetails = () => (
  <div className="p-4 bg-muted/20 rounded-lg space-y-3 mt-2">
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  </div>
);

// Job state badge with colors
const JobStateBadge = ({ state }: { state: string }) => {
  const stateColors: Record<string, string> = {
    RUNNING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    COMPLETED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    CANCELLED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  const colorClass = stateColors[state] || "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-xs py-0 h-5 rounded-md ${colorClass}`}>
      {state}
    </Badge>
  );
};

// Compact job row component
const JobRow = memo(({ 
  job, 
  isExpanded, 
  onToggle, 
  jobDetails, 
  jobDetailsIsLoading, 
  jobDetailsError 
}: { 
  job: Job; 
  isExpanded: boolean; 
  onToggle: () => void;
  jobDetails?: { jobs: JobDetails[] };
  jobDetailsIsLoading: boolean;
  jobDetailsError: any;
}) => {
  const state = job.state?.current?.[0] || "UNKNOWN";
  
  return (
    <div className="border-b last:border-b-0">
      <div 
        className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-medium text-primary">{job.job_id}</span>
            {job.array?.task_id?.set && (
              <Badge variant="secondary" className="text-xs py-0 h-5 rounded-md">
                Array [{job.array.task_id.number}]
              </Badge>
            )}
            <JobStateBadge state={state} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(job.time.start)}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>{job.user}</span>
          <span className="text-foreground truncate max-w-[200px]" title={job.name}>{job.name}</span>
          <span>{job.partition}</span>
          <span>QOS: {job.qos}</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-3">
          {jobDetailsIsLoading ? (
            <SkeletonJobDetails />
          ) : jobDetailsError ? (
            <div className="p-3 bg-red-500/10 rounded-lg text-red-400 text-sm">
              Error loading job details
            </div>
          ) : jobDetails?.jobs?.[0] ? (
            <Card className="bg-muted/20 border-muted">
              <CardContent className="p-4 space-y-3">
                {/* Resource allocation row */}
                <div className="flex items-center gap-6 text-sm">
                  <span>
                    <span className="text-muted-foreground">CPUs/Task:</span>{" "}
                    <span className="font-medium">{jobDetails.jobs[0].cpus_per_task?.number || "N/A"}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Memory:</span>{" "}
                    <span className="font-medium">
                      {jobDetails.jobs[0].memory_per_node?.number 
                        ? `${(jobDetails.jobs[0].memory_per_node.number / 1024).toFixed(1)} GB`
                        : "N/A"}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Time Limit:</span>{" "}
                    <span className="font-medium">{jobDetails.jobs[0].time_limit?.number || "N/A"} min</span>
                  </span>
                </div>

                {/* Nodes */}
                {jobDetails.jobs[0].nodes && (
                  <div className="text-sm py-2 px-3 bg-muted/30 rounded-lg">
                    <span className="text-muted-foreground">Nodes:</span>{" "}
                    <span className="font-mono">{jobDetails.jobs[0].nodes}</span>
                  </div>
                )}

                {/* GRES */}
                {jobDetails.jobs[0].gres_detail?.length > 0 && jobDetails.jobs[0].gres_detail[0] && (
                  <div className="text-sm py-2 px-3 bg-muted/30 rounded-lg">
                    <span className="text-muted-foreground">GRES:</span>{" "}
                    <span className="font-mono">{jobDetails.jobs[0].gres_detail.join(", ")}</span>
                  </div>
                )}

                {/* GPU Utilization */}
                {jobDetails.jobs[0].gres_detail?.some(g => g.toLowerCase().includes("gpu")) && (
                  <div className="py-2">
                    <JobGPUStats jobId={job.job_id} variant="full" />
                  </div>
                )}

                {/* Command */}
                {jobDetails.jobs[0].command && (
                  <div className="text-sm py-2 px-3 bg-muted/30 rounded-lg">
                    <span className="text-muted-foreground">Command:</span>
                    <code className="ml-2 text-xs font-mono truncate block mt-1">
                      {jobDetails.jobs[0].command}
                    </code>
                  </div>
                )}

                {/* Paths - compact */}
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {jobDetails.jobs[0].standard_output && (
                    <div className="truncate text-muted-foreground">
                      <span className="font-medium">Output:</span> {jobDetails.jobs[0].standard_output}
                    </div>
                  )}
                  {jobDetails.jobs[0].standard_error && (
                    <div className="truncate text-muted-foreground">
                      <span className="font-medium">Error:</span> {jobDetails.jobs[0].standard_error}
                    </div>
                  )}
                </div>

                {/* Flags */}
                {jobDetails.jobs[0].flags?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs text-muted-foreground">Flags:</span>
                    {jobDetails.jobs[0].flags.map((flag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs py-0 h-5 rounded-md">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="p-3 bg-muted/20 rounded-lg text-muted-foreground text-sm text-center">
              No job details available
            </div>
          )}
        </div>
      )}
    </div>
  );
});
JobRow.displayName = "JobRow";

const NodeCardModal: React.FC<NodeCardModalProps> = ({
  open,
  setOpen,
  nodename,
}) => {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [metricValue, setMetricValue] = useState("node_load15");
  const [daysValue, setDaysValue] = useState("3");

  // Memoize URLs to prevent unnecessary re-fetches
  const slurmURL = useMemo(
    () => `/api/slurm/jobs/node/${nodename}`,
    [nodename]
  );
  const promURL = useMemo(
    () => `/api/prometheus?node=${nodename}&days=${daysValue}&query=${metricValue}`,
    [nodename, daysValue, metricValue]
  );
  const jobDetailsURL = useMemo(
    () => (expandedJobId ? `/api/slurm/job/${expandedJobId}` : null),
    [expandedJobId]
  );

  // SWR hooks with stable fetcher reference
  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{ jobs: Job[] }>(open ? slurmURL : null, jsonFetcher);

  const {
    data: promData,
    error: promError,
    isLoading: promIsLoading,
  } = useSWR(open ? promURL : null, jsonFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 300000,
  });

  const {
    data: jobDetails,
    error: jobDetailsError,
    isLoading: jobDetailsIsLoading,
  } = useSWR<{ jobs: JobDetails[] }>(jobDetailsURL, jsonFetcher);

  // Memoize the toggle handler
  const handleJobRowClick = useCallback((jobId: string) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  }, []);

  // Memoize running jobs count
  const runningJobsCount = useMemo(
    () => jobData?.jobs.filter((job) => job.state.current.includes("RUNNING")).length ?? 0,
    [jobData?.jobs]
  );

  if (jobError) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[400px] min-h-[200px]"
        >
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-destructive" />
            Error
          </DialogTitle>
          <div className="text-muted-foreground">
            Failed to load, or session expired. Please try again.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1100px] max-w-[90vw] h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pr-8">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-muted-foreground font-normal">Node</span>{" "}
              <span className="font-mono text-primary">{nodename}</span>
            </div>
          </DialogTitle>

          <div className="flex items-center gap-4">
            <PromComboBox
              metricValue={metricValue}
              setMetricValue={setMetricValue}
              daysValue={daysValue}
              setDaysValue={setDaysValue}
            />
            <NodeUtilization nodeName={nodename} />
          </div>
        </div>

        <Separator />

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col space-y-4 pr-2">
          {/* Metrics Panel - stat card + chart */}
          <div className="flex-shrink-0">
            <NodeMetricsPanel 
              data={promData} 
              metricName={metricValue}
              isLoading={promIsLoading}
            />
          </div>

          {/* Jobs Section */}
          {jobIsLoading ? (
            <div className="space-y-2 flex-shrink-0">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonJobCard key={i} />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Current Jobs on System
                </h3>
                <Badge variant="secondary" className="text-xs rounded-md">
                  {runningJobsCount} running
                </Badge>
              </div>

              <Card className="border-muted flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                  {!jobData?.jobs || jobData.jobs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No jobs currently running on this node
                    </div>
                  ) : (
                    jobData.jobs.map((job: Job) => (
                      <JobRow
                        key={job.job_id}
                        job={job}
                        isExpanded={expandedJobId === job.job_id}
                        onToggle={() => handleJobRowClick(job.job_id)}
                        jobDetails={expandedJobId === job.job_id ? jobDetails : undefined}
                        jobDetailsIsLoading={expandedJobId === job.job_id && jobDetailsIsLoading}
                        jobDetailsError={expandedJobId === job.job_id ? jobDetailsError : null}
                      />
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(NodeCardModal);
