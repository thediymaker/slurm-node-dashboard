import useSWR from "swr";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DNA } from "react-loader-spinner";
import { NodeCpuChart } from "../node-cpu-chart";
import JobDetailModal from "./job-detail-modal";
import { useState } from "react";

const NodeCardModal = ({ open, setOpen, nodename }: any) => {
  const [showDetails, setShowDetails] = useState(false);
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
  } = useSWR(open ? slurmURL : null, jobFetcher);

  const promURL = `/api/prometheus/${nodename}`;
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
        <DialogTitle className="p-0 m-0"></DialogTitle>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl min-w-[800px] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
        >
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
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] min-h-[300px] max-h-[90%] overflow-y-auto scrollbar-none"
      >
        <div>
          <DialogTitle className="text-2xl mb-2 font-extralight">
            {nodename}
          </DialogTitle>
          {promError || promIsLoading ? "" : <NodeCpuChart data={promData} />}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobData?.jobs.map((job: any, index: any) => (
                //TODO: Add onClick event to open job detail modal
                <TableRow
                  key={index}
                  className="cursor-pointer"
                  onClick={() => {
                    setShowDetails(!showDetails);
                  }}
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
                  <JobDetailModal
                    open={showDetails}
                    setOpen={setShowDetails}
                    searchID={job.job_id}
                  />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={8} className="text-right">
                  Total Number of jobs running on system:{" "}
                  {
                    jobData?.jobs.filter((job: any) =>
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
