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
        <DialogContent className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none">
          <div>Failed to load, or session expired, please try again.</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (jobIsLoading) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none">
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
      <DialogContent className="border shadow-xl w-[1200px] max-w-[90%] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none">
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
                          <div className="py-4 px-6 bg-background">
                            <h4 className="font-semibold mb-2">Job Details</h4>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                              <dt className="font-medium">Nodes</dt>
                              <dd>{jobDetails.jobs[0].nodes}</dd>
                              <dt className="font-medium">Command</dt>
                              <dd>{jobDetails.jobs[0].command}</dd>
                              <dt className="font-medium">State</dt>
                              <dd>{jobDetails.jobs[0].job_state.join(", ")}</dd>
                              <dt className="font-medium">CPUs Per Task</dt>
                              <dd>{jobDetails.jobs[0].cpus_per_task.number}</dd>
                              <dt className="font-medium">
                                Memory per Node (GB)
                              </dt>
                              <dd>
                                {jobDetails.jobs[0].memory_per_node.number /
                                  1024}
                              </dd>
                              <dt className="font-medium">Gres Detail</dt>
                              <dd>
                                {jobDetails.jobs[0].gres_detail.join(", ")}
                              </dd>
                              <dt className="font-medium">Output Path</dt>
                              <dd>{jobDetails.jobs[0].standard_output}</dd>
                              <dt className="font-medium">Error Path</dt>
                              <dd>{jobDetails.jobs[0].standard_error}</dd>
                              <dt className="font-medium">Input Path</dt>
                              <dd>{jobDetails.jobs[0].standard_input}</dd>
                              <dt className="font-medium">Time Limit (mins)</dt>
                              <dd>{jobDetails.jobs[0].time_limit.number}</dd>
                              <dt className="font-medium">Priority</dt>
                              <dd>{jobDetails.jobs[0].priority.number}</dd>
                            </dl>
                          </div>
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
