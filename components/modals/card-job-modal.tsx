import { useState, useCallback, useMemo, memo } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronRight, ChevronUp, Server, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import React from "react";
import { Job, JobDetails, NodeCardModalProps } from "@/types/types";
import { NodeMetricsPanel } from "../nodeCard/node-metrics-panel";
import { NodeHistoryPanel } from "../nodeCard/node-history-panel";
import { metricGroups, dayArray } from "../prom-metric";
import NodeUtilization from "../node-utilization";
import { JobGPUStats } from "@/components/job-gpu-stats";
import { CopyButton, formatMemory } from "@/components/llm/llm-shared-utils";
import { useFeature } from "@/components/runtime-config";
import { getStatusColor } from "@/lib/color-schemas";
import { getStatusDef } from "@/utils/nodes";
import { parseGPUResources } from "@/utils/gpu-parse";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";

type SlurmNumber = number | { set?: boolean; infinite?: boolean; number?: number } | null | undefined;

// The node fields the sheet reads; the Details tab shows everything else too
interface NodeInfo {
  name?: string;
  hostname?: string;
  address?: string;
  state?: string[] | string;
  state_flags?: string[];
  reason?: string;
  reason_set_by_user?: string;
  reason_changed_at?: SlurmNumber;
  partitions?: string[];
  features?: string[];
  active_features?: string[];
  cpus?: number;
  alloc_cpus?: number;
  cpu_load?: SlurmNumber;
  sockets?: number;
  cores?: number;
  threads?: number;
  real_memory?: number;
  alloc_memory?: number;
  free_mem?: SlurmNumber;
  gres?: string;
  gres_used?: string;
  tres?: string;
  tres_used?: string;
  architecture?: string;
  operating_system?: string;
  version?: string;
  boot_time?: SlurmNumber;
  last_busy?: SlurmNumber;
  reservation?: string;
  comment?: string;
  energy?: { current_watts?: SlurmNumber; average_watts?: number };
  [key: string]: unknown;
}

// Jobs from slurmdbd carry more than the shared Job type lists
interface NodeJob extends Job {
  time: { start: number; elapsed?: number };
  tres?: { allocated?: { type: string; name?: string; count: number }[] };
}

interface GpuUtil {
  gpu: string;
  modelName: string;
  hpcJob: string;
  utilization: number;
}

const toNumber = (value: SlurmNumber): number | undefined => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && value.set !== false && typeof value.number === "number") return value.number;
  return undefined;
};

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

// 6:41:12, or 2d 6:41:12 past a day
const formatElapsed = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${days > 0 ? `${days}d ` : ""}${h}:${m}:${sec}`;
};

const jobElapsed = (job: NodeJob): number =>
  job.time.elapsed && job.time.elapsed > 0 ? job.time.elapsed : Date.now() / 1000 - job.time.start;

// CPUs and GPUs from the job's allocated TRES. Slurm can list the GPU count
// both as gres/gpu and per type (gres/gpu:a100), so the plain entry wins.
const jobResources = (job: NodeJob): { cpus?: number; gpus: number } => {
  const allocated = job.tres?.allocated ?? [];
  const cpus = allocated.find((t) => t.type === "cpu")?.count;
  const gpuEntries = allocated.filter((t) => t.type === "gres" && t.name?.startsWith("gpu"));
  const plain = gpuEntries.find((t) => t.name === "gpu");
  const gpus = plain ? plain.count : gpuEntries.reduce((sum, t) => sum + t.count, 0);
  return { cpus, gpus };
};

const toStateArray = (state: NodeInfo["state"]): string[] =>
  Array.isArray(state) ? state : typeof state === "string" ? state.split(/[+\s]+/).filter(Boolean) : [];

// Same priority order the node cards use to pick a color
const STATE_PRIORITY = [
  "DOWN", "NOT_RESPONDING", "DRAIN", "REBOOT_REQUESTED",
  "RESERVED", "COMPLETING", "MIXED", "ALLOCATED", "PLANNED", "FUTURE", "IDLE",
];

const STATE_LABELS: Record<string, string> = {
  DOWN: "Down",
  NOT_RESPONDING: "Not responding",
  REBOOT_REQUESTED: "Reboot requested",
  RESERVED: "Reserved",
  COMPLETING: "Completing",
  MIXED: "Partial",
  ALLOCATED: "Full",
  PLANNED: "Planned",
  FUTURE: "Future",
  IDLE: "Idle",
};

const stateLabel = (states: string[]): string => {
  const primary = STATE_PRIORITY.find((p) => states.some((s) => s.toUpperCase().includes(p)));
  if (!primary) return states[0] ?? "Unknown";
  if (primary === "DRAIN") {
    // Still running jobs while it drains
    return states.some((s) => /MIXED|ALLOCATED|COMPLETING/.test(s.toUpperCase())) ? "Draining" : "Drained";
  }
  return STATE_LABELS[primary];
};

const readColorSchema = () => {
  try {
    return localStorage.getItem("colorSchema") || "default";
  } catch {
    return "default";
  }
};

const RANGE_LABELS: Record<string, string> = { "1": "24h", "3": "3d", "7": "7d", "15": "15d", "30": "30d" };

const METRIC_GROUP_LABELS: Record<string, string> = {
  "CPU & Load": "Load",
  Memory: "Memory",
  Network: "Network",
  Temperature: "Temp",
  "GPU (DCGM)": "GPU",
};

// Generic JSON fetcher for SWR - stable reference
const jsonFetcher = (url: string) =>
  fetch(url, {
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());

// Same URL as the node grid, so the sheet reads the grid's cached response
const nodesURL = withBasePath("/api/slurm/nodes");
const nodesFetcher = async (url: string) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load nodes");
  return res.json();
};

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
    RUNNING: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/20",
    PENDING: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/20",
    COMPLETED: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/20",
    FAILED: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/20",
    CANCELLED: "bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-500/20",
  };
  const colorClass = stateColors[state] || "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-xs py-0 h-5 rounded-md ${colorClass}`}>
      {state}
    </Badge>
  );
};

// Thin usage bar shared by the tiles, GPU rows and the jobs table
const Bar = ({ percent, className }: { percent: number; className?: string }) => (
  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
    <div
      className={cn("h-full rounded-full transition-all", className)}
      style={{
        width: `${Math.min(Math.max(percent, 0), 100)}%`,
        ...(className ? {} : { background: "hsl(var(--chart-1))" }),
      }}
    />
  </div>
);

const utilBarClass = (util: number) =>
  util >= 70 ? "bg-emerald-500" : util >= 30 ? "bg-amber-500" : "bg-red-500";

const AllocationTile = ({ label, used, total, percent }: { label: string; used: string; total: string; percent: number }) => (
  <div className="flex flex-col gap-2 rounded-lg border bg-card px-3.5 py-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xl font-semibold tabular-nums">
      {used} <span className="text-sm font-normal text-muted-foreground">/ {total}</span>
    </span>
    <Bar percent={percent} />
  </div>
);

const SectionTitle = ({ title, count }: { title: string; count?: number | string }) => (
  <div className="flex items-baseline gap-2">
    <h3 className="text-sm font-semibold">{title}</h3>
    {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
  </div>
);

// Expandable job row for the Jobs tab: summary line, then the job's details
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
  jobDetailsError: unknown;
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
            <span className="text-xs text-muted-foreground" title={convertUnixToHumanReadable(job.time.start)}>
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
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
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

// Compact table of the running jobs for the Overview tab. Clicking a row opens
// it in the Jobs tab.
const RunningJobsTable = ({
  jobs,
  showGpu,
  gpuUtilByJob,
  onSelect,
}: {
  jobs: NodeJob[];
  showGpu: boolean;
  gpuUtilByJob: Map<string, number>;
  onSelect: (jobId: string) => void;
}) => {
  const columns = showGpu
    ? "grid-cols-[84px_minmax(0,1.4fr)_minmax(0,1fr)_92px_100px_76px]"
    : "grid-cols-[84px_minmax(0,1.4fr)_minmax(0,1fr)_60px_76px]";

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className={cn("min-w-[520px]", showGpu && "min-w-[600px]")}>
        <div className={cn("grid gap-2.5 border-b px-3.5 py-2 text-[11px] uppercase tracking-wide text-muted-foreground", columns)}>
          <span>Job</span>
          <span>Name</span>
          <span>User</span>
          <span>{showGpu ? "CPUs / GPUs" : "CPUs"}</span>
          {showGpu && <span>GPU util</span>}
          <span className="text-right">Elapsed</span>
        </div>
        {jobs.map((job) => {
          const { cpus, gpus } = jobResources(job);
          const util = gpuUtilByJob.get(String(job.job_id));
          return (
            <button
              key={job.job_id}
              type="button"
              onClick={() => onSelect(job.job_id)}
              className={cn(
                "grid w-full items-center gap-2.5 border-t px-3.5 py-2.5 text-left text-sm first:border-t-0 hover:bg-muted/50 transition-colors",
                columns
              )}
            >
              <span className="font-mono text-xs text-primary underline-offset-2 hover:underline">{job.job_id}</span>
              <span className="truncate" title={job.name}>{job.name}</span>
              <span className="truncate text-muted-foreground">{job.user}</span>
              <span className="font-mono text-xs">
                {cpus ?? "—"}
                {showGpu && ` / ${gpus}`}
              </span>
              {showGpu && (
                <span className="flex items-center gap-2">
                  {util !== undefined ? (
                    <>
                      <Bar percent={util} className={utilBarClass(util)} />
                      <span className="w-8 shrink-0 text-xs text-muted-foreground tabular-nums">{Math.round(util)}%</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>
              )}
              <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                {formatElapsed(jobElapsed(job))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const DetailRow = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
  <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-t px-3.5 py-2 text-sm first:border-t-0">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn("break-words", mono && "font-mono text-xs leading-5")}>{children}</span>
  </div>
);

const NodeCardModal: React.FC<NodeCardModalProps> = ({
  open,
  setOpen,
  nodename,
}) => {
  const prometheusEnabled = useFeature("prometheus");
  const gpuMetricsEnabled = useFeature("gpu");
  const [tab, setTab] = useState("overview");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [metricValue, setMetricValue] = useState("node_load15");
  const [daysValue, setDaysValue] = useState("3");
  const [colorSchema] = useState(readColorSchema);

  // Memoize URLs to prevent unnecessary re-fetches
  const slurmURL = useMemo(
    () => withBasePath(`/api/slurm/jobs/node/${nodename}`),
    [nodename]
  );
  const promURL = useMemo(
    () => withBasePath(`/api/prometheus?node=${nodename}&days=${daysValue}&query=${metricValue}`),
    [nodename, daysValue, metricValue]
  );
  const jobDetailsURL = useMemo(
    () => (expandedJobId ? withBasePath(`/api/slurm/job/${expandedJobId}`) : null),
    [expandedJobId]
  );

  // SWR hooks with stable fetcher reference
  // The grid already refreshes the node list, so cached data isn't refetched
  const { data: nodesData, isLoading: nodesIsLoading } = useSWR<{ nodes: NodeInfo[] }>(
    open ? nodesURL : null,
    nodesFetcher,
    { revalidateIfStale: false }
  );

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{ jobs: NodeJob[] }>(open ? slurmURL : null, jsonFetcher);

  const {
    data: promData,
    isLoading: promIsLoading,
  } = useSWR(open && prometheusEnabled ? promURL : null, jsonFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 300000,
  });

  const {
    data: jobDetails,
    error: jobDetailsError,
    isLoading: jobDetailsIsLoading,
  } = useSWR<{ jobs: JobDetails[] }>(jobDetailsURL, jsonFetcher);

  const node = useMemo(
    () => nodesData?.nodes?.find((n) => n.name === nodename || n.hostname === nodename),
    [nodesData, nodename]
  );

  const gpu = useMemo(
    () => parseGPUResources(node?.gres ?? null, node?.gres_used ?? ""),
    [node?.gres, node?.gres_used]
  );
  const isGpuNode = gpu.gpuTotal > 0;
  const hostname = node?.hostname || nodename;

  // Per-GPU utilization from DCGM, also used for each job's GPU utilization
  const { data: gpuUtilData, isLoading: gpuUtilIsLoading } = useSWR<{ status: number; data?: GpuUtil[] }>(
    open && isGpuNode && gpuMetricsEnabled ? withBasePath(`/api/gpu/node?name=${encodeURIComponent(hostname)}`) : null,
    jsonFetcher,
    { refreshInterval: 60000 }
  );
  const gpuUtils = useMemo(
    () =>
      gpuUtilData?.status === 200 && gpuUtilData.data
        ? [...gpuUtilData.data].sort((a, b) => Number(a.gpu) - Number(b.gpu))
        : [],
    [gpuUtilData]
  );
  const gpuUtilByJob = useMemo(() => {
    const byJob = new Map<string, number[]>();
    for (const g of gpuUtils) {
      if (!g.hpcJob || g.hpcJob === "unknown") continue;
      byJob.set(g.hpcJob, [...(byJob.get(g.hpcJob) ?? []), g.utilization]);
    }
    return new Map([...byJob].map(([job, values]) => [job, values.reduce((a, b) => a + b, 0) / values.length]));
  }, [gpuUtils]);

  // Memoize the toggle handler
  const handleJobRowClick = useCallback((jobId: string) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  }, []);

  const openJob = useCallback((jobId: string) => {
    setExpandedJobId(jobId);
    setTab("jobs");
  }, []);

  const runningJobs = useMemo(
    () => jobData?.jobs?.filter((job) => job.state.current.includes("RUNNING")) ?? [],
    [jobData?.jobs]
  );

  const states = useMemo(
    () => [...toStateArray(node?.state), ...(node?.state_flags ?? [])],
    [node?.state, node?.state_flags]
  );
  const stateColor = useMemo(
    () => (node ? getStatusColor(states, colorSchema) : null),
    [node, states, colorSchema]
  );

  // Metric picker: groups as segments, metrics in the group as a select.
  // GPU metrics only make sense on GPU nodes.
  const groups = useMemo(
    () =>
      metricGroups
        .map((g) => ({ ...g, metrics: g.metrics.filter((m) => isGpuNode || !m.value.startsWith("DCGM_")) }))
        .filter((g) => g.metrics.length > 0),
    [isGpuNode]
  );
  const activeGroup = groups.find((g) => g.metrics.some((m) => m.value === metricValue)) ?? groups[0];

  const cpus = node?.cpus ?? 0;
  const allocCpus = node?.alloc_cpus ?? 0;
  const realMemory = node?.real_memory ?? 0;
  const allocMemory = node?.alloc_memory ?? 0;
  // cpu_load from Slurm API is scaled by 100 (3025 = 30.25)
  const cpuLoad = (toNumber(node?.cpu_load) ?? 0) / 100;
  const bootTime = toNumber(node?.boot_time);
  const lastBusy = toNumber(node?.last_busy);
  const reasonChangedAt = toNumber(node?.reason_changed_at);
  const watts = toNumber(node?.energy?.current_watts);
  const features = node?.active_features?.length ? node.active_features : node?.features ?? [];

  const gpuSummary = isGpuNode
    ? gpu.resources
        .filter((r: { total: number }) => r.total > 0)
        .map((r: { type: string; total: number }) => {
          // DCGM knows the full model name; the GRES type is the fallback
          const model = gpuUtils.find((g) => g.modelName && g.modelName !== "unknown")?.modelName;
          return `${r.total}× ${gpu.resources.length === 1 && model ? model : r.type.toUpperCase()}`;
        })
        .join(", ")
    : null;

  const summary = node
    ? [
        gpuSummary,
        `${cpus} cores`,
        formatMemory(realMemory),
        bootTime ? `up ${formatRelativeTime(bootTime).replace(/ ago$/, "")}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const metricControls = (
    <>
      <SegmentedControl
        aria-label="Metric group"
        value={activeGroup?.label ?? ""}
        onValueChange={(label) => {
          const group = groups.find((g) => g.label === label);
          if (group) setMetricValue(group.metrics[0].value);
        }}
        options={groups.map((g) => ({ value: g.label, label: METRIC_GROUP_LABELS[g.label] ?? g.label }))}
      />
      {activeGroup && activeGroup.metrics.length > 1 && (
        <Select value={metricValue} onValueChange={setMetricValue}>
          <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activeGroup.metrics.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex-1" />
      <NodeUtilization nodeName={nodename} className="text-xs" />
    </>
  );

  const rangeControl = (
    <SegmentedControl
      aria-label="Time range"
      value={daysValue}
      onValueChange={setDaysValue}
      options={dayArray.map((d) => ({ value: d.value, label: RANGE_LABELS[d.value] ?? d.label }))}
    />
  );

  const errorBanner = jobError ? (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
      <Server className="h-4 w-4 shrink-0 text-destructive" />
      Failed to load, or session expired. Please try again.
    </div>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        hideClose
        aria-describedby={undefined}
        overlayClassName="bg-black/50"
        onOpenAutoFocus={(e) => {
          // Focus the sheet itself rather than its first button
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        className="flex w-full flex-col gap-0 p-0 focus:outline-none sm:max-w-[760px]"
      >
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex flex-col gap-2.5 px-4 pt-5 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                <SheetTitle className="font-mono text-xl font-medium leading-tight">{nodename}</SheetTitle>
                {node && stateColor && (
                  <span
                    className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 text-xs font-medium"
                    title={getStatusDef(states)}
                  >
                    <span className={cn("h-2 w-2 rounded-full", stateColor.bgColor)} />
                    {stateLabel(states)}
                  </span>
                )}
                {node?.partitions?.map((p) => (
                  <span key={p} className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                    {p}
                  </span>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CopyButton text={nodename} className="h-8 w-8 inline-flex items-center justify-center" />
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </SheetClose>
              </div>
            </div>
            {summary ? (
              <SheetDescription className="text-[13px]">{summary}</SheetDescription>
            ) : nodesIsLoading ? (
              <Skeleton className="h-4 w-64" />
            ) : null}
            <TabsList className="mt-1 h-auto w-full justify-start gap-5 rounded-none border-b bg-transparent p-0">
              {[
                { value: "overview", label: "Overview" },
                { value: "jobs", label: "Jobs", count: jobData?.jobs?.length },
                ...(isGpuNode ? [{ value: "gpu", label: "GPU" }] : []),
                { value: "details", label: "Details" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="-mb-px rounded-none border-b-2 border-transparent px-0.5 pb-2.5 pt-1 font-normal text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t.label}
                  {t.count !== undefined && <span className="ml-1.5 text-muted-foreground tabular-nums">{t.count}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-7 pt-5 sm:px-6">
            <TabsContent value="overview" className="mt-0 flex flex-col gap-4">
              {errorBanner}

              {/* Allocation */}
              {node ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <AllocationTile
                    label="CPU cores"
                    used={String(allocCpus)}
                    total={String(cpus)}
                    percent={cpus ? (allocCpus / cpus) * 100 : 0}
                  />
                  <AllocationTile
                    label="Memory"
                    used={formatMemory(allocMemory)}
                    total={formatMemory(realMemory)}
                    percent={realMemory ? (allocMemory / realMemory) * 100 : 0}
                  />
                  {isGpuNode ? (
                    <AllocationTile
                      label="GPUs"
                      used={String(Math.round(gpu.gpuUsed * 10) / 10)}
                      total={String(gpu.gpuTotal)}
                      percent={(gpu.gpuUsed / gpu.gpuTotal) * 100}
                    />
                  ) : (
                    <AllocationTile
                      label="CPU load"
                      used={cpuLoad.toFixed(1)}
                      total={String(cpus)}
                      percent={cpus ? (cpuLoad / cpus) * 100 : 0}
                    />
                  )}
                </div>
              ) : nodesIsLoading ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-[88px] rounded-lg" />
                  ))}
                </div>
              ) : null}

              {/* Prometheus metrics */}
              {prometheusEnabled && (
                <NodeMetricsPanel
                  data={promData}
                  metricName={metricValue}
                  isLoading={promIsLoading}
                  controls={metricControls}
                  aside={rangeControl}
                />
              )}

              {/* Renders nothing when node history is off, so the card hides itself */}
              <div className="rounded-lg border bg-card p-4 empty:hidden">
                <NodeHistoryPanel nodeName={nodename} />
              </div>

              {/* Running jobs */}
              <section className="flex flex-col gap-2.5">
                <SectionTitle title="Running jobs" count={jobIsLoading ? undefined : runningJobs.length} />
                {jobIsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }, (_, i) => (
                      <SkeletonJobCard key={i} />
                    ))}
                  </div>
                ) : runningJobs.length === 0 ? (
                  <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                    No jobs currently running on this node
                  </div>
                ) : (
                  <RunningJobsTable
                    jobs={runningJobs}
                    showGpu={isGpuNode}
                    gpuUtilByJob={gpuUtilByJob}
                    onSelect={openJob}
                  />
                )}
              </section>
            </TabsContent>

            <TabsContent value="jobs" className="mt-0 flex flex-col gap-3">
              {errorBanner}
              {jobIsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <SkeletonJobCard key={i} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <SectionTitle title="Current jobs on this node" />
                    <Badge variant="secondary" className="text-xs rounded-md">
                      {runningJobs.length} running
                    </Badge>
                  </div>
                  <Card className="overflow-hidden">
                    {!jobData?.jobs || jobData.jobs.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No jobs currently running on this node
                      </div>
                    ) : (
                      jobData.jobs.map((job) => (
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
                  </Card>
                </>
              )}
            </TabsContent>

            {isGpuNode && (
              <TabsContent value="gpu" className="mt-0 flex flex-col gap-4">
                <section className="flex flex-col gap-2.5">
                  <SectionTitle title="Allocation" />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {gpu.resources
                      .filter((r: { total: number; shardsTotal: number }) => r.total > 0 || r.shardsTotal > 0)
                      .map((r: { type: string; total: number; used: number; shardsTotal: number; shardsUsed: number }) => (
                        <React.Fragment key={r.type}>
                          {r.total > 0 && (
                            <AllocationTile
                              label={`${gpu.isMIG ? "MIG " : ""}${r.type.toUpperCase()}`}
                              used={String(r.used)}
                              total={String(r.total)}
                              percent={(r.used / r.total) * 100}
                            />
                          )}
                          {r.shardsTotal > 0 && (
                            <AllocationTile
                              label={`${r.type.toUpperCase()} shards`}
                              used={String(r.shardsUsed)}
                              total={String(r.shardsTotal)}
                              percent={(r.shardsUsed / r.shardsTotal) * 100}
                            />
                          )}
                        </React.Fragment>
                      ))}
                  </div>
                  <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                    <div>GRES: {node?.gres}</div>
                    <div>GRES used: {node?.gres_used}</div>
                  </div>
                </section>

                <section className="flex flex-col gap-2.5">
                  <SectionTitle title="Utilization" count={gpuUtils.length ? "last 5 minutes" : undefined} />
                  {!gpuMetricsEnabled ? (
                    <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                      Per-GPU utilization needs DCGM metrics in Prometheus.
                    </div>
                  ) : gpuUtilIsLoading ? (
                    <Skeleton className="h-28 w-full rounded-lg" />
                  ) : gpuUtils.length === 0 ? (
                    <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                      No GPU utilization data from Prometheus for this node.
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card">
                      {gpuUtils.map((g) => {
                        const job = g.hpcJob && g.hpcJob !== "unknown" ? g.hpcJob : null;
                        return (
                          <div
                            key={g.gpu}
                            className="grid grid-cols-[56px_minmax(0,1fr)_88px_minmax(80px,140px)] items-center gap-3 border-t px-3.5 py-2.5 text-sm first:border-t-0"
                          >
                            <span className="font-mono text-xs">GPU {g.gpu}</span>
                            <span className="truncate text-xs text-muted-foreground" title={g.modelName}>
                              {g.modelName !== "unknown" ? g.modelName : ""}
                            </span>
                            {job ? (
                              <button
                                type="button"
                                className="text-left font-mono text-xs text-primary underline-offset-2 hover:underline"
                                onClick={() => openJob(job)}
                              >
                                {job}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">idle</span>
                            )}
                            <span className="flex items-center gap-2">
                              <Bar percent={g.utilization} className={utilBarClass(g.utilization)} />
                              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                {Math.round(g.utilization)}%
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </TabsContent>
            )}

            <TabsContent value="details" className="mt-0 flex flex-col gap-4">
              {!node ? (
                nodesIsLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : (
                  <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                    No node information available
                  </div>
                )
              ) : (
                <>
                  {node.reason && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-sm">
                      <div className="font-medium">{node.reason}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          node.reason_set_by_user && `Set by ${node.reason_set_by_user}`,
                          reasonChangedAt && convertUnixToHumanReadable(reasonChangedAt),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border bg-card">
                    <DetailRow label="State" mono>{states.join(", ") || "—"}</DetailRow>
                    <DetailRow label="Status">{getStatusDef(states)}</DetailRow>
                    {node.reservation && <DetailRow label="Reservation" mono>{node.reservation}</DetailRow>}
                    <DetailRow label="Partitions" mono>{node.partitions?.join(", ") || "—"}</DetailRow>
                    {features.length > 0 && <DetailRow label="Features" mono>{features.join(", ")}</DetailRow>}
                    <DetailRow label="CPUs">
                      {allocCpus} of {cpus} allocated · load {cpuLoad.toFixed(2)}
                      {node.sockets ? ` · ${node.sockets} sockets × ${node.cores} cores × ${node.threads} threads` : ""}
                    </DetailRow>
                    <DetailRow label="Memory">
                      {formatMemory(allocMemory)} of {formatMemory(realMemory)} allocated
                      {toNumber(node.free_mem) !== undefined && ` · ${formatMemory(toNumber(node.free_mem)!)} free`}
                    </DetailRow>
                    {node.gres && <DetailRow label="GRES" mono>{node.gres}</DetailRow>}
                    {node.gres_used && <DetailRow label="GRES used" mono>{node.gres_used}</DetailRow>}
                    {node.tres && <DetailRow label="TRES" mono>{node.tres}</DetailRow>}
                    {node.tres_used && <DetailRow label="TRES used" mono>{node.tres_used}</DetailRow>}
                    {watts !== undefined && watts > 0 && (
                      <DetailRow label="Power">
                        {watts} W{node.energy?.average_watts ? ` · avg ${node.energy.average_watts} W` : ""}
                      </DetailRow>
                    )}
                    {prometheusEnabled && (
                      <DetailRow label="CPU utilization">
                        <NodeUtilization nodeName={nodename} />
                      </DetailRow>
                    )}
                    {node.architecture && <DetailRow label="Architecture">{node.architecture}</DetailRow>}
                    {node.operating_system && <DetailRow label="OS" mono>{node.operating_system}</DetailRow>}
                    {node.version && <DetailRow label="Slurm version" mono>{node.version}</DetailRow>}
                    {node.address && <DetailRow label="Address" mono>{node.address}</DetailRow>}
                    {bootTime ? (
                      <DetailRow label="Boot time">
                        {convertUnixToHumanReadable(bootTime)} ({formatRelativeTime(bootTime)})
                      </DetailRow>
                    ) : null}
                    {lastBusy ? (
                      <DetailRow label="Last busy">
                        {convertUnixToHumanReadable(lastBusy)} ({formatRelativeTime(lastBusy)})
                      </DetailRow>
                    ) : null}
                    {node.comment && <DetailRow label="Comment">{node.comment}</DetailRow>}
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                      <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                      Raw node data
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="relative mt-2">
                        <CopyButton text={JSON.stringify(node, null, 2)} className="absolute right-2 top-2" />
                        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                          {JSON.stringify(node, null, 2)}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default memo(NodeCardModal);
