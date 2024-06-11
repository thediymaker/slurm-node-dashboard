import useSWR from "swr";
import { Dialog, DialogContent } from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DNA } from "react-loader-spinner";

const JobCardModal = ({ open, setOpen, jobId }: any) => {
  const jobFetcher = () =>
    fetch(`/api/slurm/job/${jobId}`, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR(open ? `/api/slurm/job/${jobId}` : null, jobFetcher);

  function convertUnixToHumanReadable(unixTimestamp: any) {
    const date = new Date(unixTimestamp * 1000);
    const formattedDate = date.toLocaleString();
    return formattedDate;
  }

  console.log(jobData);

  if (jobError)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none">
          <div>Failed to load, or session expired, please try again.</div>
        </DialogContent>
      </Dialog>
    );

  if (jobIsLoading)
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border shadow-xl w-[1200px] max-w-[90%] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none">
        {jobData && jobData?.jobs?.length > 0 ? (
          <div>
            <h1 className="text-2xl mb-2 font-extralight">{jobId}</h1>
            <div className="mb-5">Job Details</div>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Nodes</TableCell>
                  <TableCell>{jobData?.jobs[0].nodes}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Command</TableCell>
                  <TableCell>{jobData?.jobs[0].command}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>State</TableCell>
                  <TableCell>{jobData?.jobs[0].job_state}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Start Time</TableCell>
                  <TableCell>
                    {convertUnixToHumanReadable(
                      jobData?.jobs[0].start_time.number
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>End Time</TableCell>
                  <TableCell>
                    {convertUnixToHumanReadable(
                      jobData?.jobs[0].end_time.number
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>CPUs Per Task</TableCell>
                  <TableCell>{jobData?.jobs[0].cpus_per_task.number}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Memory per Node (MB)</TableCell>
                  <TableCell>
                    {jobData?.jobs[0].memory_per_node.number}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Gres Detail</TableCell>
                  <TableCell>{jobData?.jobs[0].gres_detail}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Output Path</TableCell>
                  <TableCell>{jobData?.jobs[0].standard_output}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>{jobData?.jobs[0].user_name}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="m-auto text-center">
            <h1 className="font-bold text-xl">Invalid Job ID.</h1>
            <p className="mt-5 font-extralight">
              Job data is only available while the job is running, or shortly
              after the job has completed.
            </p>
            <p className="mt-5">Please try another job ID.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default JobCardModal;
