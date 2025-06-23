import { useState } from "react";
import useSWR from "swr";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";
import { Job, JobDetails, NodeCardModalProps } from "@/types/types";
import { NodeCpuChart } from "../nodeCard/node-mon-chart";
import PromComboBox from "../prom-metric";
import NodeUtilization from "../node-utilization";

const NodeCardModal: React.FC<NodeCardModalProps> = ({
  open,
  setOpen,
  nodename,
}) => {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [metricValue, setMetricValue] = useState("node_load15");
  const [daysValue, setDaysValue] = useState("3");

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";

  const slurmURL = `/api/slurm/jobs/node/${nodename}`;
  const jobFetcher = () =>
    fetch(slurmURL, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR<{
    jobs: Job[];
  }>(open ? slurmURL : null, jobFetcher);

  const promURL = `/api/prometheus?node=${nodename}&days=${daysValue}&query=${metricValue}`;
  const promFetcher = () =>
    fetch(promURL, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const {
    data: promData,
    error: promError,
    isLoading: promIsLoading,
  } = useSWR(open ? promURL : null, promFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 300000,
  });

  const {
    data: jobDetails,
    error: jobDetailsError,
    isLoading: jobDetailsIsLoading,
  } = useSWR<{ jobs: JobDetails[] }>(
    expandedJobId ? `${baseURL}/api/slurm/job/${expandedJobId}` : null,
    (url: any) =>
      fetch(url, {
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json())
  );

  const convertUnixToHumanReadable = (unixTimestamp: number): string => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString();
  };

  // Skeleton loaders
  const renderSkeletonHeader = () => (
    <div className="flex justify-between items-center mb-4 mr-10">
      <Skeleton className="h-8 w-64" />
      <div className="flex items-center gap-8">
        <div>
          <Skeleton className="h-10 w-80" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>
    </div>
  );

  const renderSkeletonChart = () => <Skeleton className="h-72 w-full mb-6" />;

  const renderSkeletonTable = () => (
    <>
      <Skeleton className="h-6 w-48 mb-5" />
      <div className="border rounded-md">
        <div className="border-b p-4">
          <div className="grid grid-cols-9 gap-4">
            {Array(9)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
          </div>
        </div>
        <div className="p-4 space-y-6">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="grid grid-cols-9 gap-4">
                {Array(9)
                  .fill(0)
                  .map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
              </div>
            ))}
        </div>
        <div className="border-t p-4">
          <div className="flex justify-end">
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
    </>
  );

  if (jobError) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
          <DialogTitle></DialogTitle>
          <div>Failed to load, or session expired, please try again.</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] min-h-[90%] max-h-[90%] overflow-y-auto scrollbar-none"
      >
        <div>
          {jobIsLoading ? (
            // Show skeleton UI while loading
            <>
              <DialogTitle className="text-2xl font-extralight mb-3">
                {nodename}
              </DialogTitle>
              {renderSkeletonChart()}
              {renderSkeletonTable()}
            </>
          ) : (
            // Show actual content when loaded
            <>
              <div className="flex justify-between items-center mb-4 mr-10">
                <DialogTitle className="text-2xl font-extralight">
                  {nodename}
                </DialogTitle>

                {!promError && !promIsLoading && promData?.status !== 404 && (
                  <div className="flex items-center gap-8">
                    <div>
                      <PromComboBox
                        metricValue={metricValue}
                        setMetricValue={setMetricValue}
                        daysValue={daysValue}
                        setDaysValue={setDaysValue}
                      />
                    </div>
                    <NodeUtilization nodeName={nodename} />
                  </div>
                )}
              </div>

              {promIsLoading ? (
                <Skeleton className="h-72 w-full mb-6" />
              ) : (
                !promError &&
                promData?.status !== 404 && <NodeCpuChart data={promData} />
              )}

              <div className="mb-5">Current Jobs on System</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Task ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Partition</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>QOS</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobData?.jobs.map((job: Job) => (
                    <React.Fragment key={job.job_id}>
                      <TableRow
                        key={job.job_id}
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedJobId(
                            expandedJobId === job.job_id ? null : job.job_id
                          )
                        }
                      >
                        <TableCell>{job.job_id}</TableCell>
                        <TableCell>
                          {job.array && job.array.task_id.set
                            ? `${job.array.job_id}[${job.array.task_id.number}]`
                            : "N/A"}
                        </TableCell>
                        <TableCell>{job.user}</TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {job.name}
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {job.partition}
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {job.group}
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {job.qos}
                        </TableCell>
                        <TableCell>
			                    {convertUnixToHumanReadable(job?.time?.start)}
                        </TableCell>
                        <TableCell className="flex justify-end">
                          {expandedJobId === job.job_id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedJobId === job.job_id && (
                        <TableRow>
                          <TableCell colSpan={9}>
                            {jobDetailsIsLoading ? (
                              <Card>
                                <CardHeader>
                                  <Skeleton className="h-6 w-32" />
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 gap-4">
                                    {Array(12)
                                      .fill(0)
                                      .map((_, i) => (
                                        <div key={i}>
                                          <Skeleton className="h-4 w-32 mb-2" />
                                          <Skeleton className="h-4 w-full" />
                                        </div>
                                      ))}
                                  </div>
                                  <Separator className="my-4" />
                                  <div>
                                    <Skeleton className="h-4 w-20 mb-2" />
                                    <div className="flex flex-wrap gap-2">
                                      {Array(5)
                                        .fill(0)
                                        .map((_, i) => (
                                          <Skeleton
                                            key={i}
                                            className="h-6 w-16 rounded-full"
                                          />
                                        ))}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : jobDetailsError ? (
                              <div className="py-4 text-center text-red-500">
                                Error loading job details
                              </div>
                            ) : jobDetails && jobDetails.jobs[0] ? (
                              <Card>
                                <CardHeader>
                                  <CardTitle>Job Details</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="font-semibold">Nodes</p>
                                      <p>{jobDetails.jobs[0].nodes}</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">Command</p>
                                      <p className="truncate">
                                        {jobDetails.jobs[0].command}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">State</p>
                                      <p>
                                        {
                                            Array.isArray(jobDetails?.jobs?.[0]?.job_state)
                                              ? jobDetails.jobs[0].job_state.join(", ")
                                              : jobDetails?.jobs?.[0]?.job_state ?? ""
                                        }	
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        CPUs Per Task
                                      </p>
                                      <p>
                                        {
                                          jobDetails.jobs[0].cpus_per_task
                                            .number
                                        }
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        Memory per Node (GB)
                                      </p>
                                      <p>
                                        {jobDetails.jobs[0].memory_per_node
                                          .number / 1024}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        Gres Detail
                                      </p>
                                      <p>
                                        {jobDetails.jobs[0].gres_detail.join(
                                          ", "
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        Output Path
                                      </p>
                                      <p className="truncate">
                                        {jobDetails.jobs[0].standard_output}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        Error Path
                                      </p>
                                      <p className="truncate">
                                        {jobDetails.jobs[0].standard_error}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        Input Path
                                      </p>
                                      <p className="truncate">
                                        {jobDetails.jobs[0].standard_input}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        Time Limit (mins)
                                      </p>
                                      <p>
                                        {jobDetails.jobs[0].time_limit.number}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold">Priority</p>
                                      <p>
                                        {jobDetails.jobs[0].priority.number}
                                      </p>
                                    </div>
                                  </div>
                                  <Separator className="my-4" />
                                  <div>
                                    <p className="font-semibold mb-2">Flags</p>
                                    <div className="flex flex-wrap gap-2">
                                      {jobDetails.jobs[0].flags.map(
                                        (flag, index) => (
                                          <Badge
                                            key={index}
                                            variant="secondary"
                                          >
                                            {flag}
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <div className="py-4 text-center">
                                No job details available
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={9} className="text-right">
                      Total Number of jobs running on system:{" "}
                      {
                        jobData?.jobs.filter((job: Job) =>
                          job?.state?.current.includes("RUNNING")
                        ).length
                      }
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NodeCardModal;
