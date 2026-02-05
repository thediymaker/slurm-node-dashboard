import React, { memo, useMemo } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Server, Folder, Terminal, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RunningJob, JobDetailModalProps } from "@/types/types";
import { CopyButton, formatDuration, formatMemory } from "@/components/llm/llm-shared-utils";
import { JobGPUStats } from "@/components/job-gpu-stats";

// Utility function moved outside component
const convertUnixToHumanReadable = (unixTimestamp: number): string => {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString();
};

const formatRelativeTime = (unixTimestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;
  
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)}m`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)}h`;
    return `in ${Math.floor(absDiff / 86400)}d`;
  }
  
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Shared fetcher for SWR
const jsonFetcher = (url: string) =>
  fetch(url, {
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());

// Skeleton component
const SkeletonContent = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="p-3 rounded-lg border bg-muted/30">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
    <div className="p-3 rounded-lg bg-muted/30">
      <Skeleton className="h-4 w-full" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="p-3 rounded-lg border bg-muted/30">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  </div>
);

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  open,
  setOpen,
  searchID,
}) => {
  const jobURL = useMemo(() => `/api/slurm/job/${searchID}`, [searchID]);

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{ jobs: RunningJob[] }>(open ? jobURL : null, jsonFetcher);

  if (jobError) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="border shadow-xl max-w-[600px]">
          <div className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Error Loading Job</DialogTitle>
              <p className="text-sm text-muted-foreground">Failed to load job data. Please try again.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!jobData && !jobIsLoading) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="border shadow-xl max-w-[600px]">
          <div className="text-center p-6">
            <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <DialogTitle className="text-lg font-semibold mb-2">Job Not Found</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Job data is only available while the job is running or shortly after completion.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const job = jobData?.jobs?.[0];
  const isPending = job?.job_state?.[0] === "PENDING";
  const isRunning = job?.job_state?.[0] === "RUNNING";
  const primaryState = job?.job_state?.[0] || "UNKNOWN";

  const renderJobContent = (job: RunningJob) => {
    const cpus = job.cpus_per_task?.number || job.cpus?.number || 0;
    const memory = job.memory_per_node?.number || (job.memory_per_cpu?.number ? job.memory_per_cpu.number * cpus : 0);
    
    return (
      <div className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Partition</div>
            <div className="font-medium text-sm">{job.partition || "N/A"}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Nodes</div>
            <div className="font-medium text-sm font-mono">{job.nodes || "Pending"}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">CPUs</div>
            <div className="font-semibold text-primary">{cpus || "N/A"}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Memory</div>
            <div className="font-medium text-sm">{memory ? formatMemory(memory) : "N/A"}</div>
          </div>
        </div>

        {/* GPU Utilization (only for running jobs with GPUs) */}
        {isRunning && job.tres_req_str?.includes("gpu") && (
          <JobGPUStats jobId={searchID} variant="full" />
        )}

        {/* Pending Reason */}
        {isPending && job.state_reason && job.state_reason !== "None" && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-md border bg-muted/30 text-sm">
            <span className="text-muted-foreground">Reason:</span>
            <span className="font-medium">{job.state_reason}</span>
          </div>
        )}

        {/* User & Time Info Row */}
        <div className="flex items-center gap-4 text-xs py-2 px-3 bg-muted/30 rounded-lg flex-wrap">
          <span>
            <span className="text-muted-foreground">User:</span>{" "}
            <span className="font-medium">{job.user_name || "N/A"}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">QoS:</span>{" "}
            <span className="font-medium">{job.qos || "N/A"}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Time Limit:</span>{" "}
            <span className="font-medium">{job.time_limit?.number ? formatDuration(job.time_limit.number) : "∞"}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Priority:</span>{" "}
            <span className="font-medium">{job.priority?.number?.toLocaleString() || "N/A"}</span>
          </span>
        </div>

        {/* Command */}
        {job.command && (
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Command</span>
              </div>
              <CopyButton text={job.command} />
            </div>
            <code className="text-xs font-mono text-muted-foreground break-all block">
              {job.command.length > 200 ? `${job.command.slice(0, 200)}...` : job.command}
            </code>
          </div>
        )}

        {/* Requested Resources */}
        {job.tres_req_str && (
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Requested Resources</span>
            </div>
            <code className="text-xs font-mono text-foreground">{job.tres_req_str}</code>
          </div>
        )}

        <Separator />

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Submit Time</div>
            <div className="text-sm font-medium">
              {job.submit_time?.number ? convertUnixToHumanReadable(job.submit_time.number) : "N/A"}
            </div>
            {job.submit_time?.number && (
              <div className="text-xs text-muted-foreground">{formatRelativeTime(job.submit_time.number)}</div>
            )}
          </div>
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Start Time</div>
            <div className="text-sm font-medium">
              {job.start_time?.number ? convertUnixToHumanReadable(job.start_time.number) : isPending ? "Waiting..." : "N/A"}
            </div>
            {job.start_time?.number && (
              <div className="text-xs text-muted-foreground">{formatRelativeTime(job.start_time.number)}</div>
            )}
          </div>
        </div>

        {/* Paths */}
        <div className="space-y-2">
          {job.current_working_directory && (
            <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg text-xs">
              <Folder className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Work Dir:</span>
              <span className="font-mono truncate flex-1">{job.current_working_directory}</span>
              <CopyButton text={job.current_working_directory} />
            </div>
          )}
          {job.standard_output && (
            <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg text-xs">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Output:</span>
              <span className="font-mono truncate flex-1">{job.standard_output}</span>
              <CopyButton text={job.standard_output} />
            </div>
          )}
          {job.standard_error && job.standard_error !== job.standard_output && (
            <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Error:</span>
              <span className="font-mono truncate flex-1">{job.standard_error}</span>
              <CopyButton text={job.standard_error} />
            </div>
          )}
        </div>

        {/* Flags */}
        {job.flags && job.flags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Flags:</span>
            {job.flags.map((flag, index) => (
              <Badge key={index} variant="secondary" className="text-xs py-0 h-5 rounded-md">
                {flag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[800px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <span className="font-mono">{searchID}</span>
              <CopyButton text={searchID} />
              <Badge 
                variant="secondary" 
                className={`rounded-md font-medium text-xs ${
                  isRunning ? 'bg-emerald-500/15 text-emerald-300' : 
                  isPending ? 'bg-amber-500/15 text-amber-300' : 
                  'bg-muted text-muted-foreground'
                }`}
              >
                {primaryState}
              </Badge>
            </DialogTitle>
            {job && <div className="text-sm text-muted-foreground">{job.name || "Unnamed Job"}</div>}
          </div>
        </div>

        <Separator />

        {/* Content */}
        <div className="py-2">
          {jobIsLoading ? (
            <SkeletonContent />
          ) : (
            job && renderJobContent(job)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(JobDetailModal);
