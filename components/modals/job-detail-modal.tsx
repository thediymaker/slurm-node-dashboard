import React from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Cpu, HardDrive, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RunningJob, JobDetailModalProps } from "@/utils/nodes";

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  open,
  setOpen,
  searchID,
}) => {
  const jobFetcher = () =>
    fetch(`/api/slurm/job/${searchID}`, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const { data: jobData, error: jobError, isLoading: jobIsLoading } = useSWR<{
    jobs: RunningJob[];
  }>(open ? `/api/slurm/job/${searchID}` : null, jobFetcher);

  function convertUnixToHumanReadable(unixTimestamp: number) {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString();
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
              Job data is only available while the job is running, or shortly
              after the job has completed.
            </p>
            <p className="mt-5">Please try another job ID.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const job = jobData?.jobs[0];

  const renderJobOverview = (job: RunningJob) => (
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
          <div className="text-2xl font-bold">{job.user_name}</div>
          <p className="text-xs text-muted-foreground">{job.group_name}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPUs / Memory</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {job.cpus_per_task?.number || "N/A"} CPUs
          </div>
          <p className="text-xs text-muted-foreground">
            {job.memory_per_node?.number
              ? `${(job.memory_per_node.number / 1024).toFixed(2)} GB RAM`
              : "N/A"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Time Limit</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {job.time_limit?.number ? `${job.time_limit.number} mins` : "N/A"}
          </div>
          <p className="text-xs text-muted-foreground">
            Priority: {job.priority?.number || "N/A"}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderJobDetails = (job: RunningJob) => (
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
            <p className="font-semibold">Command</p>
            <p className="truncate">{job.command}</p>
          </div>
          <div>
            <p className="font-semibold">State</p>
            <p>{job.job_state?.join(", ")}</p>
          </div>
          <div>
            <p className="font-semibold">Start Time</p>
            <p>
              {job.start_time
                ? convertUnixToHumanReadable(job.start_time.number)
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="font-semibold">End Time</p>
            <p>
              {job.end_time
                ? convertUnixToHumanReadable(job.end_time.number)
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="font-semibold">Partition</p>
            <p>{job.partition}</p>
          </div>
          <div>
            <p className="font-semibold">Gres Detail</p>
            <p>{job.gres_detail?.join(", ")}</p>
          </div>
          <div>
            <p className="font-semibold">Output Path</p>
            <p className="truncate">{job.standard_output}</p>
          </div>
          <div>
            <p className="font-semibold">Error Path</p>
            <p className="truncate">{job.standard_error}</p>
          </div>
          <div>
            <p className="font-semibold">Input Path</p>
            <p className="truncate">{job.standard_input}</p>
          </div>
          <div>
            <p className="font-semibold">Allocated Cores</p>
            <p>{job.job_resources?.allocated_cores}</p>
          </div>
          <div>
            <p className="font-semibold">Allocated Nodes</p>
            <p>
              {job.job_resources?.allocated_nodes
                .map((node) => node.nodename)
                .join(", ")}
            </p>
          </div>
        </div>
        <Separator className="my-4" />
        <div>
          <p className="font-semibold mb-2">Flags</p>
          <div className="flex flex-wrap gap-2">
            {job.flags?.map((flag, index) => (
              <Badge key={index} variant="secondary">
                {flag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[900px] max-w-[90%] h-[750px] max-h-[90%] overflow-y-auto scrollbar-none"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl mb-2 font-extralight flex items-center gap-2">
            Active Job Details: {searchID}
            <Badge
              variant={
                job.job_state?.includes("RUNNING") ? "default" : "secondary"
              }
            >
              {job.job_state?.[0] || "UNKNOWN"}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="pr-4">
          {renderJobOverview(job)}
          {renderJobDetails(job)}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default JobDetailModal;
