"use client";
import useSWR from "swr";
import { Dialog, DialogContent } from "../ui/dialog";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { useState } from "react";

const UserJobModal = ({ open, setOpen, searchID }: any) => {
  const [currentPage, setCurrentPage] = useState(1);
  const jobFetcher = () =>
    fetch(`/api/slurm/jobs/user/${searchID}`, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

  const itemsPerPage = 20;

  const {
    data: jobData,
    error: jobError,
    isLoading: jobIsLoading,
  } = useSWR(open ? `/api/slurm/jobs/user/${searchID}` : null, jobFetcher);

  function convertUnixToHumanReadable(unixTimestamp: any) {
    const date = new Date(unixTimestamp * 1000);
    const formattedDate = date.toLocaleString();
    return formattedDate;
  }

  const pageCount = Math.ceil(jobData?.jobs?.length / itemsPerPage);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const currentItems = jobData?.jobs?.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: React.SetStateAction<number>) =>
    setCurrentPage(pageNumber);

  const pageNumbers: any = [];
  for (let i = 1; i <= pageCount; i++) {
    pageNumbers.push(i);
  }

  const TablePagination = () => {
    return (
      <div className="mt-2">
        <Pagination>
          <PaginationContent>
            {pageNumbers.map((number: any, index: any) => (
              <PaginationItem key={index}>
                <button onClick={() => paginate(number)}>
                  {number === currentPage ? (
                    <PaginationLink isActive>{number}</PaginationLink>
                  ) : (
                    <PaginationLink>{number}</PaginationLink>
                  )}
                </button>
              </PaginationItem>
            ))}
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

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
        {jobData &&
        jobData?.errors?.length === 0 &&
        jobData?.jobs?.length > 0 ? (
          <div>
            <h1 className="text-2xl mb-2 font-extralight uppercase">
              {searchID}
            </h1>
            <div className="mb-5">User Job Details</div>
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
                {currentItems.map((job: any, index: number) => (
                  <TableRow key={index}>
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
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8} className="text-right">
                    Total Number of currently running jobs:{" "}
                    {
                      jobData?.jobs.filter((job: any) =>
                        job.state.current.includes("RUNNING")
                      ).length
                    }
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <TablePagination />
          </div>
        ) : (
          <div className="m-auto text-center">
            <h1 className="font-bold text-xl">Invalid User ID.</h1>
            <p className="mt-5 font-extralight">
              The user ID you entered does not exist, or the user does not
              currently have any jobs running on the system.
            </p>
            <p className="mt-5">Please try another user ID.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserJobModal;
