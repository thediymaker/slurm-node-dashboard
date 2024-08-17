import React from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, Cpu, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HistoricalJobDetailModalProps, HistoricalJob } from "@/utils/nodes";

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

  const { data: jobData, error: jobError, isLoading: jobIsLoading } = useSWR<{
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

  function calculateEfficiency(job: HistoricalJob) {
    const allocatedCPUs =
      job.tres.allocated.find((t) => t.type === "cpu")?.count || 0;
    const elapsedTime = job.time.elapsed;

    // Aggregate total CPU time (in seconds) from all steps using user and system time
    const totalCPUTime = job.steps.reduce((sum, step) => {
      const stepUserTime =
        step.time.user.seconds + step.time.user.microseconds / 1e6;
      const stepSystemTime =
        step.time.system.seconds + step.time.system.microseconds / 1e6;
      const stepTotalSeconds = stepUserTime + stepSystemTime;

      console.log(`Step User Time: ${stepUserTime} seconds`);
      console.log(`Step System Time: ${stepSystemTime} seconds`);
      console.log(`Step Total CPU Time: ${stepTotalSeconds} seconds`);

      return sum + stepTotalSeconds;
    }, 0);

    console.log(`Allocated CPUs: ${allocatedCPUs}`);
    console.log(`Elapsed Time: ${elapsedTime} seconds`);
    console.log(`Total CPU Time: ${totalCPUTime} seconds`);

    if (allocatedCPUs === 0 || elapsedTime === 0) return "N/A";
    if (totalCPUTime === 0) return "No CPU usage recorded";

    // Calculate the core wall time
    const coreWallTime = allocatedCPUs * elapsedTime;
    const efficiency = (totalCPUTime / coreWallTime) * 100;

    console.log(`Efficiency: ${efficiency}%`);

    return `${efficiency.toFixed(2)}%`;
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
            <Skeleton className="h-8 w-8 rounded-full" />
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
            Efficiency: {calculateEfficiency(job)}
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
    <Card className="mt-6">
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
              <p className="font-semibold">Allocated Resources</p>
              {job.tres.allocated.map((res, index) => (
                <p key={index}>
                  {res.type}: {res.count}
                </p>
              ))}
            </div>
            <div>
              <p className="font-semibold">Requested Resources</p>
              {job.tres.requested.map((res, index) => (
                <p key={index}>
                  {res.type}: {res.count}
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
                Start Time: {convertUnixToHumanReadable(step.time.start.number)}
              </p>
              <p>
                End Time: {convertUnixToHumanReadable(step.time.end.number)}
              </p>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div>
          <p className="font-semibold">Working Directory</p>
          <p className="truncate">{job.working_directory}</p>
        </div>
        <div className="mt-2">
          <p className="font-semibold">Submit Command</p>
          <p className="truncate">{job.submit_line}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] h-[90%] overflow-y-auto scrollbar-none"
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
