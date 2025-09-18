"use client";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Job, JobDetails } from "@/types/types";

interface UserJobModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  searchID: string;
}

const UserJobModal: React.FC<UserJobModalProps> = ({
  open,
  setOpen,
  searchID,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
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

  function convertUnixToHumanReadable(unixTimestamp: number) {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString();
  }

  const pageCount = Math.ceil((jobData?.jobs?.length || 0) / itemsPerPage);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const currentItems = jobData?.jobs?.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const {
    data: jobDetails,
    error: jobDetailsError,
    isLoading: jobDetailsIsLoading,
  } = useSWR<{ jobs: JobDetails[] }>(
    expandedJobId ? `/api/slurm/job/${expandedJobId}` : null,
    (url: string) =>
      fetch(url, {
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json())
  );

  // Render skeleton loader for the table
  const renderSkeletonTable = () => (
    <div>
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-6 w-36 mb-5" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-4 w-12" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-12" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-10" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-6" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(10)].map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-18" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-14" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-6" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={8} className="text-right">
              <Skeleton className="h-4 w-64 ml-auto" />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <div className="mt-2">
        <Pagination>
          <PaginationContent className="flex justify-center">
            {[...Array(5)].map((_, index) => (
              <PaginationItem key={index}>
                <Skeleton className="h-8 w-8 mx-1" />
              </PaginationItem>
            ))}
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );

  const TablePagination = () => {
    const renderPageNumbers = () => {
      const maxPagesToShow = 10;
      const paginationItems = [];

      // If there are fewer than or equal to maxPagesToShow pages, show all
      if (pageCount <= maxPagesToShow) {
        for (let number = 1; number <= pageCount; number++) {
          paginationItems.push(
            <PaginationItem key={number}>
              <button onClick={() => paginate(number)}>
                {number === currentPage ? (
                  <PaginationLink isActive>{number}</PaginationLink>
                ) : (
                  <PaginationLink>{number}</PaginationLink>
                )}
              </button>
            </PaginationItem>
          );
        }
      } else {
        // If there are more than maxPagesToShow pages
        // Always show the first page
        paginationItems.push(
          <PaginationItem key={1}>
            <button onClick={() => paginate(1)}>
              {1 === currentPage ? (
                <PaginationLink isActive>{1}</PaginationLink>
              ) : (
                <PaginationLink>{1}</PaginationLink>
              )}
            </button>
          </PaginationItem>
        );

        // Determine start and end pages for the current range
        let startPage, endPage;
        if (currentPage <= 6) {
          // Show first 10 pages
          startPage = 2;
          endPage = 9;
        } else if (currentPage + 4 >= pageCount) {
          // Show last 10 pages
          startPage = pageCount - 8;
          endPage = pageCount - 1;
        } else {
          // Show current page in the middle
          startPage = currentPage - 4;
          endPage = currentPage + 4;
        }

        // Add ellipsis after the first page if needed
        if (startPage > 2) {
          paginationItems.push(
            <PaginationItem key="start-ellipsis">
              <PaginationEllipsis />
            </PaginationItem>
          );
        }

        // Add the page numbers in the calculated range
        for (let number = startPage; number <= endPage; number++) {
          paginationItems.push(
            <PaginationItem key={number}>
              <button onClick={() => paginate(number)}>
                {number === currentPage ? (
                  <PaginationLink isActive>{number}</PaginationLink>
                ) : (
                  <PaginationLink>{number}</PaginationLink>
                )}
              </button>
            </PaginationItem>
          );
        }

        // Add ellipsis before the last page if needed
        if (endPage < pageCount - 1) {
          paginationItems.push(
            <PaginationItem key="end-ellipsis">
              <PaginationEllipsis />
            </PaginationItem>
          );
        }

        // Always show the last page
        paginationItems.push(
          <PaginationItem key={pageCount}>
            <button onClick={() => paginate(pageCount)}>
              {pageCount === currentPage ? (
                <PaginationLink isActive>{pageCount}</PaginationLink>
              ) : (
                <PaginationLink>{pageCount}</PaginationLink>
              )}
            </button>
          </PaginationItem>
        );
      }

      return paginationItems;
    };

    return (
      <div className="mt-2">
        <Pagination>
          <PaginationContent>{renderPageNumbers()}</PaginationContent>
        </Pagination>
      </div>
    );
  };

  if (jobError)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="border shadow-xl w-[1200px] max-w-[90%] h-[90vh] overflow-y-auto scrollbar-none"
        >
          <DialogTitle>Error</DialogTitle>
          <div>Failed to load, or session expired, please try again.</div>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="border shadow-xl w-[1200px] max-w-[90%] h-[90vh] overflow-y-auto scrollbar-none"
      >
        <DialogTitle className="sr-only">User Job Information</DialogTitle>
        {jobIsLoading ? (
          renderSkeletonTable()
        ) : jobData &&
          jobData?.errors?.length === 0 &&
          jobData?.jobs?.length > 0 ? (
          <div>
            <h1 className="text-2xl mb-2 font-extralight uppercase">
              {searchID}
            </h1>
            <DialogTitle className="mb-5">User Job Details</DialogTitle>
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
                {currentItems.map((job: Job, index: number) => (
                  <>
                    <TableRow
                      key={`${job.job_id}-row`}
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
                      <TableRow key={`${job.job_id}-details`}>
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
                                      {jobDetails.jobs[0].job_state.join(
                                        ", "
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">CPUs Per Task</p>
                                    <p>
                                      {jobDetails.jobs[0].cpus_per_task.number}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Memory per Node (GB)</p>
                                    <p>
                                      {jobDetails.jobs[0].memory_per_node.number /
                                        1024}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold">Gres Detail</p>
                                    <p>
                                      {jobDetails.jobs[0].gres_detail.join(
                                        ", "
                                      )}
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
                                    <p className="font-semibold">Time Limit (mins)</p>
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
