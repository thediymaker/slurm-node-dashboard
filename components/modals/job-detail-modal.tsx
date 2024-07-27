import useSWR from "swr";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "../ui/table";
import { DNA } from "react-loader-spinner";

const JobDetailModal = ({ open, setOpen, searchID }: any) => {
  const jobFetcher = () =>
    fetch(`/api/slurm/job/${searchID}`, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR(open ? `/api/slurm/job/${searchID}` : null, jobFetcher);

  function convertUnixToHumanReadable(unixTimestamp: any) {
    const date = new Date(unixTimestamp * 1000);
    const formattedDate = date.toLocaleString();
    return formattedDate;
  }

  if (jobError)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
      >
        <div>
          <DialogTitle className="text-2xl mb-2 font-extralight">
            {searchID}
          </DialogTitle>
          <div className="mb-5">Job Details</div>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Job ID</TableCell>
                <TableCell>{job?.job_id}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Job Name</TableCell>
                <TableCell>{job?.name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Nodes</TableCell>
                <TableCell>{job?.nodes}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Command</TableCell>
                <TableCell>{job?.command}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>State</TableCell>
                <TableCell>{job?.job_state?.join(", ")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Start Time</TableCell>
                <TableCell>
                  {job?.start_time?.number
                    ? convertUnixToHumanReadable(job?.start_time?.number)
                    : "N/A"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>End Time</TableCell>
                <TableCell>
                  {job?.end_time?.number
                    ? convertUnixToHumanReadable(job?.end_time?.number)
                    : "N/A"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>CPUs Per Task</TableCell>
                <TableCell>{job?.cpus_per_task?.number}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Memory per Node (GB)</TableCell>
                <TableCell>
                  {job?.memory_per_node?.number
                    ? job?.memory_per_node?.number / 1024
                    : "N/A"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Gres Detail</TableCell>
                <TableCell>{job?.gres_detail?.join(", ")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Output Path</TableCell>
                <TableCell>{job?.standard_output}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>{job?.user_name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Group Name</TableCell>
                <TableCell>{job?.group_name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Partition</TableCell>
                <TableCell>{job?.partition}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Job Resources</TableCell>
                <TableCell>
                  Cores: {job?.job_resources?.allocated_cores}, Nodes:{" "}
                  {job?.job_resources?.allocated_nodes
                    ?.map((node: any) => node.nodename)
                    ?.join(", ")}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Flags</TableCell>
                <TableCell>{job?.flags?.join(", ")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Standard Error Path</TableCell>
                <TableCell>{job?.standard_error}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Standard Input Path</TableCell>
                <TableCell>{job?.standard_input}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Time Limit (mins)</TableCell>
                <TableCell>{job?.time_limit?.number}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Priority</TableCell>
                <TableCell>{job?.priority?.number}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobDetailModal;
