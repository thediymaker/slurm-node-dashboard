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
import { Skeleton } from "@/components/ui/skeleton";
import { HistoricalJobDetailModalProps, HistoricalJob } from "@/types/types";

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
    try {
      // In this Slurm configuration, we don't have step-level memory data
      // Instead, show the allocated vs requested memory as a basic efficiency indicator
      const allocMem_MiB =
        job.tres.allocated.find((t) => t.type === "mem")?.count || 0;

      const reqMem_MiB =
        job.tres.requested.find((t) => t.type === "mem")?.count || 0;

      if (allocMem_MiB === 0 || reqMem_MiB === 0) {
        return "No memory data";
      }

      // Simple efficiency: allocated memory as a percentage of requested
      // This isn't a true efficiency measure but gives some indication of resource allocation
      const efficiency = (allocMem_MiB / reqMem_MiB) * 100;
      return `${efficiency.toFixed(2)}%`;
    } catch (error) {
      console.error("Error calculating memory allocation:", error);
      return "N/A";
    }
  }

  function calculateCPUEfficiency(job: HistoricalJob) {
    try {
      // For clusters without step-level CPU data, we calculate efficiency differently
      // We'll use a proxy measurement based on general job info

      const allocatedCPUs =
        job.tres.allocated.find((t) => t.type === "cpu")?.count || 0;

      const requestedCPUs =
        job.tres.requested.find((t) => t.type === "cpu")?.count || 0;

      const elapsedTime = job.time.elapsed;

      if (allocatedCPUs === 0 || requestedCPUs === 0 || elapsedTime === 0) {
        return "No CPU data";
      }

      // Since we don't have CPU time measurements, we'll use CPU utilization percentage
      // This assumes 100% utilization during job runtime as an approximation
      const efficiency = (allocatedCPUs / requestedCPUs) * 100;

      return `${efficiency.toFixed(2)}%`;
    } catch (error) {
      console.error("Error calculating CPU allocation:", error);
      return "N/A";
    }
  }

  function get_letter_grade(score: number) {
    try {
      if (isNaN(score)) return "N/A";

      var letter = "E";
      for (var [key, subobj] of Object.entries(rubric)) {
        if (score >= subobj.threshold) {
          letter = key;
          break;
        }
      }
      return letter;
    } catch (error) {
      console.error("Error in grade calculation:", error);
      return "N/A";
    }
  }

  function grade_efficiency(efficiencyStr: string) {
    try {
      if (
        efficiencyStr === "N/A" ||
        efficiencyStr === "No step data" ||
        efficiencyStr === "No CPU usage recorded"
      ) {
        return "N/A";
      }

      const eff = Number(efficiencyStr.replace("%", ""));
      if (isNaN(eff)) return "N/A";

      const letter = get_letter_grade(eff);
      return letter;
    } catch (error) {
      console.error("Error grading efficiency:", error);
      return "N/A";
    }
  }

  // Skeleton components for loading state
  const renderSkeletonOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[...Array(4)].map((_, idx) => (
        <Card key={idx}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-3 w-full" />
            {idx === 2 && (
              <>
                <Skeleton className="h-3 w-full mt-1" />
                <Skeleton className="h-3 w-full mt-1" />
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSkeletonDetails = () => (
    <div className="mt-6 w-full">
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(12)].map((_, idx) => (
              <div key={idx}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Skeleton className="h-4 w-48 mb-2" />
                {[...Array(3)].map((_, idx) => (
                  <Skeleton key={idx} className="h-3 w-full mt-2" />
                ))}
              </div>
              <div>
                <Skeleton className="h-4 w-48 mb-2" />
                {[...Array(3)].map((_, idx) => (
                  <Skeleton key={idx} className="h-3 w-full mt-2" />
                ))}
              </div>
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <div className="flex flex-wrap gap-2">
              {[...Array(5)].map((_, idx) => (
                <Skeleton key={idx} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <Skeleton className="h-4 w-48 mb-4" />
            {[...Array(2)].map((_, stepIdx) => (
              <div key={stepIdx} className="mb-4">
                <Skeleton className="h-4 w-48 mb-2" />
                {[...Array(5)].map((_, lineIdx) => (
                  <Skeleton key={lineIdx} className="h-3 w-full mt-2" />
                ))}
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-48 mb-2" />
              <div className="bg-secondary/10 rounded px-3 py-2">
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <div>
              <Skeleton className="h-4 w-48 mb-2" />
              <div className="bg-secondary/10 rounded px-3 py-2">
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

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
              Historical job data is not available for this job ID.
            </p>
            <p className="mt-5">Please try another job ID.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const renderJobOverview = (job: HistoricalJob) => {
    const CPUEfficiency = calculateCPUEfficiency(job);
    const MemEfficiency = calculateMemEfficiency(job);
    const CPUEffLetter = grade_efficiency(CPUEfficiency);
    const MemEffLetter = grade_efficiency(MemEfficiency);

    return (
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
              CPU Efficiency: {CPUEfficiency}
              {CPUEffLetter !== "N/A" && (
                <span style={{ color: rubric[CPUEffLetter].color }}>
                  ({CPUEffLetter})
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Memory Efficiency: {MemEfficiency}
              {MemEffLetter !== "N/A" && (
                <span style={{ color: rubric[MemEffLetter].color }}>
                  ({MemEffLetter})
                </span>
              )}
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
  };

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
            {job.steps && job.steps.length > 0 ? (
              job.steps.map((step, index) => {
                try {
                  // Check if step has required data structure
                  const stepId = step.step?.id || `Unknown-${index}`;
                  const stepName = step.step?.name || `Step-${stepId}`;
                  return (
                    <div key={index} className="mb-4">
                      <p className="font-semibold">
                        {stepName} (ID: {stepId})
                      </p>
                      {step.nodes && (
                        <p>
                          Nodes: {step.nodes.count} ({step.nodes.range || "N/A"}
                          )
                        </p>
                      )}
                      {step.tasks && <p>Tasks: {step.tasks.count}</p>}
                      {step.time && step.time.start && (
                        <p>
                          Start Time:{" "}
                          {convertUnixToHumanReadable(step.time.start.number)}
                        </p>
                      )}
                      {step.time && step.time.end && (
                        <p>
                          End Time:{" "}
                          {convertUnixToHumanReadable(step.time.end.number)}
                        </p>
                      )}
                      <p>
                        Memory Used/Allocated:{" "}
                        {(() => {
                          try {
                            const memUsed =
                              step.tres?.requested?.max?.find(
                                (t: { type: string }) => t.type === "mem"
                              )?.count || 0;

                            const allocMem =
                              job.tres.requested.find((t) => t.type === "mem")
                                ?.count || 0;

                            const memUsedGB = (memUsed / 1073741824).toFixed(3);
                            const allocMemGB = (allocMem / 1024).toFixed(3);

                            return `${memUsedGB} / ${allocMemGB} GiB`;
                          } catch (error) {
                            console.error(
                              "Error calculating memory usage:",
                              error
                            );
                            return "N/A";
                          }
                        })()}
                      </p>
                    </div>
                  );
                } catch (error) {
                  console.error("Error rendering step:", error);
                  return (
                    <div key={index} className="mb-4">
                      <p className="font-semibold">Step {index + 1}</p>
                      <p>Error displaying step data</p>
                    </div>
                  );
                }
              })
            ) : (
              <div className="p-4 bg-secondary/10 rounded">
                <p className="font-semibold">Job Summary</p>
                <p>Total runtime: {formatDuration(job.time.elapsed)}</p>
                <p>
                  Allocated CPUs:{" "}
                  {job.tres.allocated.find((t) => t.type === "cpu")?.count ||
                    "N/A"}
                </p>
                <p>
                  Allocated Memory:{" "}
                  {(
                    (job.tres.allocated.find((t) => t.type === "mem")?.count ||
                      0) / 1024
                  ).toFixed(2)}{" "}
                  GB
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Note: Detailed step data is not available for this job.
                </p>
              </div>
            )}
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
            {jobIsLoading ? (
              <Skeleton className="h-8 w-64" />
            ) : (
              <>
                Completed Job Details: {searchID}
                <Badge
                  variant={
                    jobData?.jobs[0].state.current.includes("COMPLETED")
                      ? "default"
                      : "secondary"
                  }
                >
                  {jobData?.jobs[0].state.current[0] || "UNKNOWN"}
                </Badge>
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <div>
          {jobIsLoading ? (
            <>
              {renderSkeletonOverview()}
              {renderSkeletonDetails()}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoricalJobDetailModal;
