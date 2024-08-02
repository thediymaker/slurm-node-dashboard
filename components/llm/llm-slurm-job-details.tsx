import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import { Separator } from "../ui/separator";

interface SlurmJobDetailsProps {
  job: any;
}

export function SlurmJobDetails({ job }: SlurmJobDetailsProps) {
  if (!job.jobs.length)
    return (
      <div>
        Sorry, I couldn't find any job details for the job ID you provided.
        Please try again with a valid job ID.
      </div>
    );
  const jobInfo = job.jobs[0];
  return (
    <Card className="w-full mx-auto">
      <div className="flex items-center gap-4 bg-muted/50 px-6 py-4 mx-auto">
        <div className="grid gap-1">
          <CardTitle className="font-extralight">
            Slurm Job: <span className="text-blue-500">{jobInfo.job_id}</span>
          </CardTitle>
        </div>
      </div>
      <Separator className="bg-gray-500 w-[95%] mx-auto" />
      <CardContent className="p-6 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Job ID</div>
            <div>{jobInfo.job_id}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Job Name</div>
            <div>{jobInfo.name}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Nodes</div>
            <div>{jobInfo.nodes}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Command</div>
            <div>{jobInfo.command}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">State</div>
            <div>{jobInfo.job_state?.join(", ")}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Start Time</div>
            <div>
              {jobInfo?.start_time?.number
                ? convertUnixToHumanReadable(jobInfo?.start_time?.number)
                : "N/A"}
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">End Time</div>
            <div>
              {jobInfo?.end_time?.number
                ? convertUnixToHumanReadable(jobInfo?.end_time?.number)
                : "N/A"}
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">CPUs Per Task</div>
            <div>{jobInfo.cpus_per_task?.number}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">
              Memory per Node (GB)
            </div>
            <div>
              {jobInfo.memory_per_node?.number
                ? jobInfo.memory_per_node.number / 1024
                : "N/A"}
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Gres Detail</div>
            <div>{jobInfo.gres_detail?.join(", ")}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Output Path</div>
            <div>{jobInfo.standard_output}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">User</div>
            <div>{jobInfo.user_name}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Group Name</div>
            <div>{jobInfo.group_name}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Partition</div>
            <div>{jobInfo.partition}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Job Resources</div>
            <div>
              Cores: {jobInfo.job_resources?.allocated_cores}, Nodes:{" "}
              {jobInfo.job_resources?.allocated_nodes
                ?.map((node: any) => node.nodename)
                ?.join(", ")}
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">
              Standard Error Path
            </div>
            <div>{jobInfo.standard_error}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">
              Standard Input Path
            </div>
            <div>{jobInfo.standard_input}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">
              Time Limit (mins)
            </div>
            <div>{jobInfo.time_limit?.number}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
