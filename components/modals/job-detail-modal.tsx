import React, { memo, useMemo } from "react";
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
import { RunningJob, JobDetailModalProps } from "@/types/types";

// Utility function moved outside component
const convertUnixToHumanReadable = (unixTimestamp: number): string => {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString();
};

// Shared fetcher for SWR
const jsonFetcher = (url: string) =>
  fetch(url, {
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());

// Skeleton components extracted outside
const SkeletonOverview = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {Array.from({ length: 4 }, (_, idx) => (
      <Card key={idx}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const SkeletonDetails = () => (
  <Card className="mt-6">
    <CardHeader>
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 12 }, (_, idx) => (
          <div key={idx}>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <Separator className="my-4" />
      <div>
        <Skeleton className="h-4 w-20 mb-2" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, idx) => (
            <Skeleton key={idx} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  open,
  setOpen,
  searchID,
}) => {
  // Memoize URL
  const jobURL = useMemo(
    () => `/api/slurm/job/${searchID}`,
    [searchID]
  );

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{ jobs: RunningJob[] }>(open ? jobURL : null, jsonFetcher);

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

  if (!jobData && !jobIsLoading) {
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
        className="border shadow-xl w-[1200px] max-w-[90%] overflow-y-auto scrollbar-none"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl mb-2 font-extralight flex items-center gap-2">
            {jobIsLoading ? (
              <Skeleton className="h-8 w-64" />
            ) : (
              <>
                Active Job Details: {searchID}
                <Badge
                  variant={
                    jobData?.jobs[0].job_state?.includes("RUNNING")
                      ? "default"
                      : "secondary"
                  }
                >
                  {jobData?.jobs[0].job_state?.[0] || "UNKNOWN"}
                </Badge>
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="pr-4">
          {jobIsLoading ? (
            <>
              <SkeletonOverview />
              <SkeletonDetails />
            </>
          ) : (
            jobData?.jobs &&
            jobData.jobs.length > 0 && (
              <>
                {renderJobOverview(jobData.jobs[0])}
                {renderJobDetails(jobData.jobs[0])}
              </>
            )
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default memo(JobDetailModal);
