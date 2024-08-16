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
import { DNA } from "react-loader-spinner";
import { NodeCpuChart } from "../nodeCard/node-mon-chart";
import PromComboBox from "../prom-metric";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Job {
  job_id: string;
  array?: {
    task_id: {
      set: boolean;
      number: number;
    };
    job_id: string;
  };
  user: string;
  name: string;
  partition: string;
  group: string;
  qos: string;
  time: {
    start: number;
  };
  state: {
    current: string[];
  };
}

interface JobDetails extends Job {
  nodes: string;
  command: string;
  job_state: string[];
  start_time: { number: number };
  end_time: { number: number };
  cpus_per_task: { number: number };
  memory_per_node: { number: number };
  gres_detail: string[];
  standard_output: string;
  user_name: string;
  group_name: string;
  job_resources: {
    allocated_cores: number;
    allocated_nodes: { nodename: string }[];
  };
  flags: string[];
  standard_error: string;
  standard_input: string;
  time_limit: { number: number };
  priority: { number: number };
}

interface NodeCardModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  nodename: string;
}

const NodeCardModal: React.FC<NodeCardModalProps> = ({
  open,
  setOpen,
  nodename,
}) => {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [metricValue, setMetricValue] = useState("node_load15");
  const [daysValue, setDaysValue] = useState("3");

  const slurmURL = `/api/slurm/jobs/node/${nodename}`;
  const jobFetcher = () =>
    fetch(slurmURL, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const { data: jobData, error: jobError, isLoading: jobIsLoading } = useSWR<{
    jobs: Job[];
  }>(open ? slurmURL : null, jobFetcher);

  const promURL = `/api/prometheus?node=${nodename}&days=${daysValue}&query=${metricValue}`;
  const promFetcher = () =>
    fetch(promURL, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const { data: promData, error: promError, isLoading: promIsLoading } = useSWR(
    open ? promURL : null,
    promFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 300000,
    }
  );

  const {
    data: jobDetails,
    error: jobDetailsError,
    isLoading: jobDetailsIsLoading,
  } = useSWR<{ jobs: JobDetails[] }>(
    expandedJobId ? `/api/slurm/job/${expandedJobId}` : null,
    (url: any) =>
      fetch(url, {
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json())
  );

  const convertUnixToHumanReadable = (unixTimestamp: number): string => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString();
  };

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

  if (jobIsLoading) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
          <DialogTitle></DialogTitle>
          <div className="font-bold text-2xl uppercase flex justify-center items-center">
            <DNA
              visible={true}
              height="80"
              width="80"
              ariaLabel="dna-loading"
              wrapperStyle={{}}
              wrapperClass="dna-wrapper"
            />
          </div>
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
          <div className="flex justify-between items-center">
            <DialogTitle className="text-2xl mb-2 font-extralight">
              {nodename}
            </DialogTitle>

            {!promError && !promIsLoading && promData?.status !== 404 && (
              <div className="mr-10">
                <PromComboBox
                  metricValue={metricValue}
                  setMetricValue={setMetricValue}
                  daysValue={daysValue}
                  setDaysValue={setDaysValue}
                />
              </div>
            )}
          </div>
          {!promError && !promIsLoading && promData?.status !== 404 && (
            <NodeCpuChart data={promData} />
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
                <>
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
                      {convertUnixToHumanReadable(job.time.start)}
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
                          <div className="py-4 text-center">
                            Loading job details...
                          </div>
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
                                    {jobDetails.jobs[0].job_state.join(", ")}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">CPUs Per Task</p>
                                  <p>
                                    {jobDetails.jobs[0].cpus_per_task.number}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">
                                    Memory per Node (GB)
                                  </p>
                                  <p>
                                    {jobDetails.jobs[0].memory_per_node.number /
                                      1024}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">Gres Detail</p>
                                  <p>
                                    {jobDetails.jobs[0].gres_detail.join(", ")}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">Output Path</p>
                                  <p className="truncate">
                                    {jobDetails.jobs[0].standard_output}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">Error Path</p>
                                  <p className="truncate">
                                    {jobDetails.jobs[0].standard_error}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">Input Path</p>
                                  <p className="truncate">
                                    {jobDetails.jobs[0].standard_input}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold">
                                    Time Limit (mins)
                                  </p>
                                  <p>{jobDetails.jobs[0].time_limit.number}</p>
                                </div>
                                <div>
                                  <p className="font-semibold">Priority</p>
                                  <p>{jobDetails.jobs[0].priority.number}</p>
                                </div>
                              </div>
                              <Separator className="my-4" />
                              <div>
                                <p className="font-semibold mb-2">Flags</p>
                                <div className="flex flex-wrap gap-2">
                                  {jobDetails.jobs[0].flags.map(
                                    (flag, index) => (
                                      <Badge key={index} variant="secondary">
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
                </>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={9} className="text-right">
                  Total Number of jobs running on system:{" "}
                  {
                    jobData?.jobs.filter((job: Job) =>
                      job.state.current.includes("RUNNING")
                    ).length
                  }
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NodeCardModal;
