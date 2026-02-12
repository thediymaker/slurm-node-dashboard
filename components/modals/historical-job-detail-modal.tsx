import React, { memo, useMemo } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  Clock, 
  Cpu, 
  User, 
  Folder, 
  Terminal, 
  ChevronDown,
  ChevronRight,
  MemoryStick
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HistoricalJobDetailModalProps, HistoricalJob } from "@/types/types";
import { CopyButton } from "@/components/llm/llm-shared-utils";
import { GPUEfficiencyBadge } from "@/components/job-gpu-stats";
import { gpuUtilizationPluginMetadata } from "@/actions/plugins";

// Rubric for efficiency grading
const rubric: { [key: string]: { threshold: number; color: string } } = {
  A: { threshold: 90, color: "text-foreground" },
  B: { threshold: 80, color: "text-foreground" },
  C: { threshold: 70, color: "text-muted-foreground" },
  D: { threshold: 60, color: "text-muted-foreground" },
  E: { threshold: 0, color: "text-muted-foreground" },
};

// Utility functions
const convertUnixToHumanReadable = (unixTimestamp: number): string => {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString();
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatRelativeTime = (unixTimestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;
  
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

const formatMiB = (mib: number): string => {
  if (mib < 1024) return `${mib} MiB`;
  return `${(mib / 1024).toFixed(2)} GiB`;
};

const calculateMemEfficiency = (job: HistoricalJob): number => {
  const maxUsedMem_Bytes = job.steps.reduce((max, step) => {
    const maxRAM = step.tres.requested.max.find((t: any) => t.type === "mem")?.count || 0;
    return maxRAM > max ? maxRAM : max;
  }, 0);
  const allocMem_MiB = job.tres.requested.find((t) => t.type === "mem")?.count || 0;
  if (allocMem_MiB === 0) return 0;
  return (maxUsedMem_Bytes / (allocMem_MiB * 1048576)) * 100;
};

const calculateCPUEfficiency = (job: HistoricalJob): number => {
  const allocatedCPUs = job.tres.allocated.find((t) => t.type === "cpu")?.count || 0;
  const elapsedTime = job.time.elapsed;
  
  const totalCPUTime = job.steps.reduce((sum, step) => {
    const stepUserTime = step.time.user.seconds + step.time.user.microseconds / 1e6;
    const stepSystemTime = step.time.system.seconds + step.time.system.microseconds / 1e6;
    return sum + stepUserTime + stepSystemTime;
  }, 0);

  if (allocatedCPUs === 0 || elapsedTime === 0 || totalCPUTime === 0) return 0;
  return (totalCPUTime / (allocatedCPUs * elapsedTime)) * 100;
};

const getLetterGrade = (score: number): keyof typeof rubric => {
  for (const [key, subobj] of Object.entries(rubric)) {
    if (score >= subobj.threshold) return key as keyof typeof rubric;
  }
  return "E";
};

// Shared fetcher for SWR
const jsonFetcher = (url: string) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => res.json());

// Efficiency Badge Component
const EfficiencyBadge = ({ value, label }: { value: number; label: string }) => {
  const grade = getLetterGrade(value);
  const gradeInfo = rubric[grade];
  
  return (
    <div className="p-3 rounded-md border bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-semibold ${gradeInfo.color}`}>{grade}</span>
      </div>
      <div className="text-base font-medium">{value.toFixed(1)}%</div>
    </div>
  );
};

// Skeleton component
const SkeletonContent = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="p-3 rounded-lg border bg-muted/30">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="p-3 rounded-lg border bg-muted/30">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
    <div className="p-3 rounded-lg bg-muted/30">
      <Skeleton className="h-4 w-full" />
    </div>
  </div>
);

const HistoricalJobDetailModal: React.FC<HistoricalJobDetailModalProps> = ({
  open,
  setOpen,
  searchID,
}) => {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(new Set());
  
  const jobURL = useMemo(() => `/api/slurm/job/completed/${searchID}`, [searchID]);
  
  // Check if GPU data is available (for historical jobs, need metrics plugin too)
  const gpuDataURL = useMemo(() => 
    gpuUtilizationPluginMetadata.isEnabled ? `/api/gpu?job_id=${searchID}` : null,
    [searchID]
  );
  
  const { data: gpuData, isLoading: gpuDataLoading } = useSWR<{ status: number; data?: any }>(
    open && gpuDataURL ? gpuDataURL : null,
    jsonFetcher,
    { revalidateOnFocus: false }
  );
  
  // Determine if GPU badge will actually render
  const gpuBadgeWillRender = React.useMemo(() => {
    if (!gpuUtilizationPluginMetadata.isEnabled) return false;
    if (gpuDataLoading) return true; // Show skeleton, so use 3 columns
    return gpuData?.status === 200 && gpuData?.data !== undefined;
  }, [gpuData, gpuDataLoading]);

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{ jobs: HistoricalJob[] }>(open ? jobURL : null, jsonFetcher);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

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
              <p className="text-sm text-muted-foreground">Failed to load job data or session expired.</p>
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
              Historical job data is not available for this job ID.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const job = jobData?.jobs?.[0];
  const primaryState = job?.state?.current?.[0] || "UNKNOWN";
  const isCompleted = job?.state?.current?.includes("COMPLETED");

  const renderJobContent = (job: HistoricalJob) => {
    const cpuEfficiency = calculateCPUEfficiency(job);
    const memEfficiency = calculateMemEfficiency(job);
    const allocCPUs = job.tres.allocated.find((t) => t.type === "cpu")?.count || 0;
    const allocMem = job.tres.requested.find((t) => t.type === "mem")?.count || 0;

    return (
      <div className="space-y-4">
        {/* Primary Stats Grid */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Runtime</div>
            <div className="font-semibold text-primary">{formatDuration(job.time.elapsed)}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Nodes</div>
            <div className="font-medium text-sm font-mono">{job.nodes || "N/A"}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">CPUs</div>
            <div className="font-semibold">{allocCPUs}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Memory</div>
            <div className="font-medium text-sm">{formatMiB(allocMem)}</div>
          </div>
        </div>

        {/* Efficiency Grades */}
        {(() => {
          const hasGpu = job.tres.allocated.some((t) => t.type === "gres" && t.name?.includes("gpu"));
          const showGpu = hasGpu && gpuBadgeWillRender;
          const gridCols = showGpu ? "grid-cols-3" : "grid-cols-2";
          
          return (
            <div className={`grid gap-3 ${gridCols}`}>
              <EfficiencyBadge value={cpuEfficiency} label="CPU Efficiency" />
              <EfficiencyBadge value={memEfficiency} label="Memory Efficiency" />
              {showGpu && <GPUEfficiencyBadge jobId={searchID} />}
            </div>
          );
        })()}

        {/* Exit Status */}
        {job.exit_code && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-md border bg-muted/30 text-sm">
            <span className="text-muted-foreground">Exit Code:</span>
            <span className="font-mono font-medium">{job.exit_code.return_code.number}</span>
            {job.exit_code.status.length > 0 && (
              <span className="text-muted-foreground">({job.exit_code.status.join(", ")})</span>
            )}
          </div>
        )}

        {/* User & Job Info Row */}
        <div className="flex items-center gap-4 text-xs py-2 px-3 bg-muted/30 rounded-lg flex-wrap">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="font-medium">{job.user}</span>
            <span className="text-muted-foreground">/ {job.group}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Partition:</span>{" "}
            <span className="font-medium">{job.partition}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">QoS:</span>{" "}
            <span className="font-medium">{job.qos}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Priority:</span>{" "}
            <span className="font-medium">{job.priority.number.toLocaleString()}</span>
          </span>
        </div>

        {/* Submit Command */}
        {job.submit_line && (
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Submit Command</span>
              </div>
              <CopyButton text={job.submit_line} />
            </div>
            <code className="text-xs font-mono text-foreground break-all block">
              {job.submit_line.length > 200 ? `${job.submit_line.slice(0, 200)}...` : job.submit_line}
            </code>
          </div>
        )}

        {/* Time Details */}
        <div className="grid grid-cols-3 gap-3">
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Start Time</div>
            <div className="text-sm font-medium">{convertUnixToHumanReadable(job.time.start)}</div>
            <div className="text-xs text-muted-foreground">{formatRelativeTime(job.time.start)}</div>
          </div>
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">End Time</div>
            <div className="text-sm font-medium">{convertUnixToHumanReadable(job.time.end)}</div>
            <div className="text-xs text-muted-foreground">{formatRelativeTime(job.time.end)}</div>
          </div>
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Time Limit</div>
            <div className="text-sm font-medium">
              {job.time.limit.infinite ? "∞" : formatDuration(job.time.limit.number)}
            </div>
          </div>
        </div>

        <Separator />

        {/* Resources */}
        <div className="grid grid-cols-2 gap-3">
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Requested Resources</span>
            </div>
            <div className="space-y-1">
              {job.tres.requested.map((res, index) => (
                <div key={index} className="text-xs flex justify-between">
                  <span className="text-muted-foreground capitalize">{res.type}</span>
                  <span className="font-mono">{res.type === "mem" ? formatMiB(res.count) : res.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MemoryStick className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Allocated Resources</span>
            </div>
            <div className="space-y-1">
              {job.tres.allocated.map((res, index) => (
                <div key={index} className="text-xs flex justify-between">
                  <span className="text-muted-foreground capitalize">{res.type}</span>
                  <span className="font-mono">{res.type === "mem" ? formatMiB(res.count) : res.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Job Steps */}
        {job.steps && job.steps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Job Steps ({job.steps.length})</span>
            </div>
            <div className="space-y-1">
              {job.steps.map((step, index) => {
                const isExpanded = expandedSteps.has(index);
                const stepMemUsed = step.tres.requested.max.find((t: any) => t.type === "mem")?.count || 0;
                
                return (
                  <div key={index} className="rounded-lg border bg-muted/20 overflow-hidden">
                    <button
                      onClick={() => toggleStep(index)}
                      className="w-full flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{step.step.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">#{step.step.id}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span><span className="text-muted-foreground">Tasks:</span> {step.tasks.count}</span>
                        <span><span className="text-muted-foreground">Mem:</span> {formatBytes(stepMemUsed)}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 pt-1 border-t bg-muted/10 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Nodes:</span>{" "}
                          <span className="font-mono">{step.nodes.count} ({step.nodes.range})</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Start:</span>{" "}
                          {convertUnixToHumanReadable(step.time.start.number)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">End:</span>{" "}
                          {convertUnixToHumanReadable(step.time.end.number)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Exit Code:</span>{" "}
                          <span className="font-mono">{(step as any).exit_code?.return_code?.number ?? "N/A"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Paths */}
        <div className="space-y-2">
          {job.working_directory && (
            <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg text-xs">
              <Folder className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Work Dir:</span>
              <span className="font-mono truncate flex-1">{job.working_directory}</span>
              <CopyButton text={job.working_directory} />
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
        className="border shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
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
                  isCompleted ? 'bg-emerald-500/15 text-emerald-300' : 
                  primaryState === 'FAILED' || primaryState === 'CANCELLED' ? 'bg-red-500/15 text-red-300' : 
                  primaryState === 'TIMEOUT' ? 'bg-orange-500/15 text-orange-300' :
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

export default memo(HistoricalJobDetailModal);
