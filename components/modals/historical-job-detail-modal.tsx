import React from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Clock, Cpu, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HistoricalJobDetailModalProps, HistoricalJob } from "@/types/types";
import PropagateLoader from "react-spinners/PropagateLoader";

const rubric: { [key: string]: { threshold: number; color: string } } = {
  A: {
    threshold: 90,
    color: "#0f0",
  },
  B: {
    threshold: 80,
    color: "#cf0",
  },
  C: {
    threshold: 70,
    color: "#ff0",
  },
  D: {
    threshold: 60,
    color: "#f70",
  },
  E: {
    threshold: 0,
    color: "#f00",
  },
};

const HistoricalJobDetailModal: React.FC<HistoricalJobDetailModalProps> = ({
  open,
  setOpen,
  searchID,
}) => {
  const jobFetcher = () =>
    fetch(`/api/slurm/job/completed/${searchID}`, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{
    jobs: HistoricalJob[];
  }>(open ? `/api/slurm/job/completed/${searchID}` : null, jobFetcher);

  function convertUnixToHumanReadable(unixTimestamp: number) {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString();
  }

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  function calculateMemEfficiency(job: HistoricalJob) {
    const maxUsedMem_Bytes = job.steps.reduce((max, step) => {
      const maxRAM =
        step.tres.requested.max.find((t: any) => t.type === "mem")?.count || 0;
      return maxRAM > max ? maxRAM : max;
    }, 0);
    const allocMem_MiB =
      job.tres.requested.find((t) => t.type === "mem")?.count || 0;
    // compute percent ratio by converting denominator to bytes
    const efficiency = (maxUsedMem_Bytes / (allocMem_MiB * 1048576)) * 100;
    return `${efficiency.toFixed(2)}%`;
  }

  function calculateCPUEfficiency(job: HistoricalJob) {
    const allocatedCPUs =
      job.tres.allocated.find((t) => t.type === "cpu")?.count || 0;
    const elapsedTime = job.time.elapsed;

    const totalCPUTime = job.steps.reduce((sum, step) => {
      const stepUserTime =
        step.time.user.seconds + step.time.user.microseconds / 1e6;
      const stepSystemTime =
        step.time.system.seconds + step.time.system.microseconds / 1e6;
      const stepTotalSeconds = stepUserTime + stepSystemTime;

      return sum + stepTotalSeconds;
    }, 0);

    if (allocatedCPUs === 0 || elapsedTime === 0) return "N/A";
    if (totalCPUTime === 0) return "No CPU usage recorded";

    const coreWallTime = allocatedCPUs * elapsedTime;
    const efficiency = (totalCPUTime / coreWallTime) * 100;

    return `${efficiency.toFixed(2)}%`;
  }

  function get_letter_grade(score: number) {
    var letter = "E";
    for (var [key, subobj] of Object.entries(rubric)) {
      if (score >= subobj.threshold) {
        letter = key;
        break;
      }
    }
    return letter;
  }

  function grade_efficiency(efficiencyStr: string) {
    const eff = Number(efficiencyStr.replace("%", ""));
    const letter = get_letter_grade(eff);
    return letter;
  }

  if (jobError)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
          <DialogTitle>Error</DialogTitle>
          <div>Failed to load, or session expired, please try again.</div>
        </DialogContent>
      </Dialog>
    );

  if (jobIsLoading)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
          <DialogTitle></DialogTitle>
          <div className="font-bold text-2xl uppercase flex justify-center items-center">
            <PropagateLoader color="gray" />
          </div>
        </DialogContent>
      </Dialog>
    );

  if (!jobData || !jobData?.jobs || jobData?.jobs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl w-[1200px] max-w-[90%] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
          <div className="m-auto text-center">
            <DialogTitle className="font-bold text-xl">
              Invalid Job ID.
            </DialogTitle>
            <p className="mt-5 font-extralight">
              Historical job data is not available for this job ID.
            </p>
            <p className="mt-5">Please try another job ID.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const job = jobData?.jobs[0];

  const CPUEfficiency = calculateCPUEfficiency(job);
  const MemEfficiency = calculateMemEfficiency(job);
  const CPUEffLetter = grade_efficiency(CPUEfficiency);
  const MemEffLetter = grade_efficiency(MemEfficiency);

  const renderJobOverview = (job: HistoricalJob) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Job ID</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{job.job_id}</div>
          <p className="text-xs text-muted-foreground">{job.name}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">User / Group</CardTitle>
          <User className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{job.user}</div>
          <p className="text-xs text-muted-foreground">{job.group}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Runtime / Efficiency
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(job.time.elapsed)}
          </div>
          <p className="text-xs text-muted-foreground">
            CPU Efficiency: {calculateCPUEfficiency(job)}(
            <span style={{ color: rubric[CPUEffLetter].color }}>
              {CPUEffLetter}
            </span>
            )
          </p>
          <p className="text-xs text-muted-foreground">
            Memory Efficiency: {calculateMemEfficiency(job)}(
            <span
              style={{
                color: rubric[MemEffLetter as keyof typeof rubric].color,
              }}
            >
              {MemEffLetter}
            </span>
            )
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Exit Status</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {job.exit_code.status.join(", ")}
          </div>
          <p className="text-xs text-muted-foreground">
            Code: {job.exit_code.return_code.number}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderJobDetails = (job: HistoricalJob) => (
    <div className="mt-6 w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-extralight">
            <div>
              <p className="font-semibold">Nodes</p>
              <p>{job.nodes}</p>
            </div>
            <div>
              <p className="font-semibold">Partition</p>
              <p>{job.partition}</p>
            </div>
            <div>
              <p className="font-semibold">QoS</p>
              <p>{job.qos}</p>
            </div>
            <div>
              <p className="font-semibold">State</p>
              <p>{job.state.current.join(", ")}</p>
            </div>
            <div>
              <p className="font-semibold">Reason</p>
              <p>{job.state.reason}</p>
            </div>
            <div>
              <p className="font-semibold">Priority</p>
              <p>{job.priority.number}</p>
            </div>
            <div>
              <p className="font-semibold">Start Time</p>
              <p>{convertUnixToHumanReadable(job.time.start)}</p>
            </div>
            <div>
              <p className="font-semibold">End Time</p>
              <p>{convertUnixToHumanReadable(job.time.end)}</p>
            </div>
            <div>
              <p className="font-semibold">Elapsed Time</p>
              <p>{formatDuration(job.time.elapsed)}</p>
            </div>
            <div>
              <p className="font-semibold">CPUs Requested</p>
              <p>{job.required.CPUs}</p>
            </div>
            <div>
              <p className="font-semibold">Memory Requested</p>
              <p>{job.required.memory_per_node.number / 1024} GB</p>
            </div>
            <div>
              <p className="font-semibold">Time Limit</p>
              <p>
                {job.time.limit.infinite
                  ? "Unlimited"
                  : formatDuration(job.time.limit.number)}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <p className="font-semibold mb-2">Resources</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-extralight">
              <div>
                <p className="font-semibold">Requested Resources</p>
                {job.tres.requested.map((res, index) => (
                  <p key={index}>
                    {res.type}: {res.count} {res.type === "mem" ? " MiB" : ""}
                  </p>
                ))}
              </div>
              <div>
                <p className="font-semibold">Allocated Resources</p>
                {job.tres.allocated.map((res, index) => (
                  <p key={index}>
                    {res.type}: {res.count} {res.type === "mem" ? " MiB" : ""}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <p className="font-semibold mb-2">Flags</p>
            <div className="flex flex-wrap gap-2">
              {job.flags.map((flag, index) => (
                <Badge key={index} variant="secondary">
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <p className="font-semibold mb-2">Job Steps</p>
            {job.steps.map((step, index) => (
              <div key={index} className="mb-4">
                <p className="font-semibold">
                  {step.step.name} (ID: {step.step.id})
                </p>
                <p>
                  Nodes: {step.nodes.count} ({step.nodes.range})
                </p>
                <p>Tasks: {step.tasks.count}</p>
                <p>
                  Start Time:{" "}
                  {convertUnixToHumanReadable(step.time.start.number)}
                </p>
                <p>
                  End Time: {convertUnixToHumanReadable(step.time.end.number)}
                </p>
                <p>
                  Memory Used/Allocated:{" "}
                  {(
                    (step.tres.requested.max.find((t: any) => t.type === "mem")
                      ?.count || 0) / 1073741824
                  ).toFixed(3)}{" "}
                  /{" "}
                  {(
                    (job.tres.requested.find((t) => t.type === "mem")?.count ||
                      0) / 1024
                  ).toFixed(3)}{" "}
                  GiB
                </p>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Working Directory</h4>
              <div className="bg-secondary/10 rounded px-3 py-2">
                <p className="text-sm text-muted-foreground break-all">
                  {job.working_directory}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Submit Command</h4>
              <div className="bg-secondary/10 rounded px-3 py-2">
                <p className="text-sm text-muted-foreground break-all">
                  {job.submit_line}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] max-h-[90%] overflow-y-auto scrollbar-none"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl mb-2 font-extralight flex items-center gap-2">
            Completed Job Details: {searchID}
            <Badge
              variant={
                job.state.current.includes("COMPLETED")
                  ? "default"
                  : "secondary"
              }
            >
              {job.state.current[0] || "UNKNOWN"}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div>
          {renderJobOverview(job)}
          {renderJobDetails(job)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoricalJobDetailModal;
