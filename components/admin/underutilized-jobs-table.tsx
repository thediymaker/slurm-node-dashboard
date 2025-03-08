import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LineChart,
  Clock,
  User,
  Server,
  Calendar,
  Cpu,
  Gauge,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface JobData {
  jobId: string;
  jobName?: string;
  userName?: string;
  jobState?: string;
  timeLimit?: number;
  tresInfo?: string;
  gpuUtilization: number;
  currentUtilization: number;
  historicalUtilization: number;
  memoryUtilization: number;
  maxMemoryUtilization: number;
  startTime: number;
  gpuCount: number;
  timeWindow?: string;
  isNewJob?: boolean;
  hasSlurmData?: boolean;
}

interface UnderutilizedJobsTableProps {
  searchQuery?: string;
  onSelectJob: (jobId: string) => void;
  threshold?: number;
}

// Create a type for the ref
export type UnderutilizedJobsTableRef = {
  refreshData: () => void;
};

const UnderutilizedJobsTable = forwardRef<
  UnderutilizedJobsTableRef,
  UnderutilizedJobsTableProps
>(({ searchQuery = "", onSelectJob, threshold = 30 }, ref) => {
  // Get initial page from localStorage or default to 1
  const getInitialPage = () => {
    try {
      const savedPage = localStorage.getItem("underutilizedJobsCurrentPage");
      return savedPage ? parseInt(savedPage, 10) : 1;
    } catch (e) {
      return 1;
    }
  };

  // Get initial sort from localStorage or default to null
  const getInitialSort = () => {
    try {
      const savedSort = localStorage.getItem("underutilizedJobsSortOrder");
      return savedSort ? (savedSort as "asc" | "desc" | null) : null;
    } catch (e) {
      return null;
    }
  };

  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [totalJobs, setTotalJobs] = useState(0);
  const [pageSize] = useState(10);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(
    getInitialSort()
  );
  const [jumpToPage, setJumpToPage] = useState("");
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);

  // Save currentPage to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "underutilizedJobsCurrentPage",
        currentPage.toString()
      );
    } catch (e) {
      console.error("Failed to save page to localStorage:", e);
    }
  }, [currentPage]);

  // Save sortOrder to localStorage whenever it changes
  useEffect(() => {
    try {
      if (sortOrder) {
        localStorage.setItem("underutilizedJobsSortOrder", sortOrder);
      } else {
        localStorage.removeItem("underutilizedJobsSortOrder");
      }
    } catch (e) {
      console.error("Failed to save sort order to localStorage:", e);
    }
  }, [sortOrder]);

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Calculate offset for pagination
      const offset = (currentPage - 1) * pageSize;

      // Construct URL with parameters including offset and sorting
      let url = `/api/prometheus/job-metrics/underutilized?limit=${pageSize}&offset=${offset}&threshold=${threshold}`;

      if (searchQuery) {
        url += `&jobId=${encodeURIComponent(searchQuery)}`;
      }

      // Add sort parameters if sorting is active
      if (sortOrder) {
        url += `&sort=utilization&order=${sortOrder}`;
      }

      console.log(`Fetching page ${currentPage} with offset ${offset}: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch job data: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("API response:", result);

      if (result.status === 200 && result.data?.jobs) {
        setJobs(result.data.jobs);
        setTotalJobs(result.data.total);
        console.log(
          `Received ${result.data.jobs.length} jobs, total: ${result.data.total}`
        );
      } else {
        throw new Error(result.error || "Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching underutilized jobs:", err);
      setError(err instanceof Error ? err.message : "Failed to load job data");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch detailed job information for a specific page of jobs
  const fetchJobDetails = async (jobsWithoutDetails: any[]) => {
    if (!jobsWithoutDetails || jobsWithoutDetails.length === 0) return;

    setLoadingJobDetails(true);

    try {
      // Extract job IDs that need details
      const jobIds = jobsWithoutDetails.map((job) => job.jobId);

      // Make a batch request for all job details at once
      const detailsUrl = `/api/slurm/jobs?ids=${jobIds.join(",")}`;
      console.log(`Fetching details for jobs: ${jobIds.join(", ")}`);

      const response = await fetch(detailsUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.statusText}`);
      }

      const detailsResult = await response.json();

      if (detailsResult && detailsResult.jobs) {
        // Create a map of job details by job ID
        const detailsMap: { [key: string]: any } = {};
        detailsResult.jobs.forEach(
          (jobDetail: { job_id: { toString: () => any } }) => {
            const jobId = jobDetail.job_id.toString();
            detailsMap[jobId] = jobDetail;
          }
        );

        // Update the jobs array with details
        setJobs((currentJobs) =>
          currentJobs.map((job) => {
            const details = detailsMap[job.jobId];

            if (details) {
              return {
                ...job,
                jobName: details.name || job.jobName || "Unnamed job",
                userName: details.user_name || job.userName || "unknown",
                jobState: Array.isArray(details.job_state)
                  ? details.job_state.join(", ")
                  : details.job_state || job.jobState || "",
                timeLimit:
                  details.time_limit?.number ||
                  details.time_limit ||
                  job.timeLimit ||
                  0,
                tresInfo: details.tres_per_node || job.tresInfo || "",
                hasSlurmData: true,
              };
            }

            return job;
          })
        );

        console.log(
          `Updated ${Object.keys(detailsMap).length} jobs with details`
        );
      }
    } catch (error) {
      console.error("Error fetching job details:", error);
    } finally {
      setLoadingJobDetails(false);
    }
  };

  // Fetch job data when page, sort, or filters change
  useEffect(() => {
    fetchJobs();
  }, [currentPage, pageSize, searchQuery, threshold, sortOrder]);

  // After initial jobs load, fetch details for jobs missing details
  useEffect(() => {
    if (!isLoading && jobs.length > 0) {
      const jobsNeedingDetails = jobs.filter((job) => !job.hasSlurmData);
      if (jobsNeedingDetails.length > 0) {
        fetchJobDetails(jobsNeedingDetails);
      }
    }
  }, [isLoading, jobs]);

  // Reset to page 1 when search query or threshold changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, threshold]);

  // Expose the refreshData function to parent components
  useImperativeHandle(ref, () => ({
    refreshData: fetchJobs,
  }));

  // Handle toggle sort
  const toggleSort = () => {
    setSortOrder((current) => {
      if (current === null) return "asc";
      if (current === "asc") return "desc";
      return null;
    });
  };

  // Handle jump to page
  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPage("");
    }
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalJobs / pageSize);

  // Get sort icon based on current sort state
  const getSortIcon = () => {
    if (sortOrder === null) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4 ml-1" />;
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Get severity level based on utilization
  const getUtilizationSeverity = (value: number) => {
    if (value < 10) return "destructive";
    if (value < 20) return "secondary";
    return "default";
  };

  // Get color class based on utilization
  const getUtilizationColorClass = (value: number) => {
    if (value < 10) return "text-red-500";
    if (value < 20) return "text-amber-500";
    if (value < 30) return "text-yellow-500";
    return "text-green-400";
  };

  // Format time ago for display
  const formatTimeAgo = (timestamp: number) => {
    try {
      const formattedTime = formatDistanceToNow(timestamp, { addSuffix: true });
      // Highlight if job is very new (less than 10 minutes)
      const isVeryNew = Date.now() - timestamp < 600000;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <span>{formattedTime}</span>
                {isVeryNew && (
                  <Badge
                    variant="outline"
                    className="px-1 py-0 h-5 text-xs text-green-500 border-green-500"
                  >
                    new
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Started: {format(timestamp, "MMM d, yyyy h:mm a")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } catch (e) {
      return "Unknown";
    }
  };

  // Format time limit in minutes to human readable
  const formatTimeLimit = (minutes: number) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
      return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (remainingHours === 0 && remainingMinutes === 0) {
      return `${days}d`;
    } else if (remainingMinutes === 0) {
      return `${days}d ${remainingHours}h`;
    } else {
      return `${days}d ${remainingHours}h ${remainingMinutes}m`;
    }
  };

  // Render job state with appropriate styling
  const renderJobState = (state: string) => {
    const stateMap: Record<string, { color: string; icon: React.ReactNode }> = {
      RUNNING: { color: "text-green-500", icon: <Cpu className="h-3 w-3" /> },
      PENDING: {
        color: "text-yellow-500",
        icon: <Clock className="h-3 w-3" />,
      },
      COMPLETED: { color: "text-blue-500", icon: <Cpu className="h-3 w-3" /> },
      FAILED: {
        color: "text-red-500",
        icon: <AlertCircle className="h-3 w-3" />,
      },
    };

    // Extract the first word if state contains multiple values (e.g., "RUNNING, ALLOCATED")
    const primaryState = state.split(",")[0].trim();
    const stateInfo = stateMap[primaryState] || {
      color: "text-gray-500",
      icon: <Cpu className="h-3 w-3" />,
    };

    return (
      <span className={`flex items-center gap-1 ${stateInfo.color}`}>
        {stateInfo.icon}
        {primaryState}
      </span>
    );
  };

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 dark:bg-destructive/20">
        <div className="flex items-center gap-2 text-destructive dark:text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Job ID</TableHead>
              <TableHead className="w-[220px]">Job Details</TableHead>
              <TableHead className="w-[140px]">Started</TableHead>
              <TableHead className="w-[100px]">GPUs</TableHead>
              <TableHead
                className="cursor-pointer w-[140px]"
                onClick={toggleSort}
              >
                <span className="flex items-center">
                  Utilization {getSortIcon()}
                </span>
              </TableHead>
              <TableHead className="w-[120px]">Memory</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Server className="h-10 w-10 text-muted-foreground/50" />
                    <p>
                      {searchQuery
                        ? "No matching jobs found"
                        : "No underutilized jobs found"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.jobId} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <span className="flex items-center">{job.jobId}</span>
                  </TableCell>
                  <TableCell>
                    {loadingJobDetails && !job.hasSlurmData ? (
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ) : job.hasSlurmData ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <div className="cursor-pointer group">
                            <div className="font-medium group-hover:text-primary transition-colors">
                              {job.jobName || "Unnamed job"}
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground space-x-2">
                              <span className="flex items-center">
                                <User className="h-3.5 w-3.5 mr-1" />
                                {job.userName || "unknown"}
                              </span>
                              {job.jobState && (
                                <span className="inline-block">•</span>
                              )}
                              {job.jobState && renderJobState(job.jobState)}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-0">
                          <div className="bg-primary/5 p-4 rounded-t-md border-b">
                            <div className="font-medium text-lg mb-1">
                              {job.jobName || "Unnamed job"}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <User className="h-3.5 w-3.5 mr-1" />{" "}
                              {job.userName || "unknown"}
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                  Job State
                                </div>
                                <div className="flex items-center">
                                  {job.jobState
                                    ? renderJobState(job.jobState)
                                    : "N/A"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                  Time Limit
                                </div>
                                <div className="flex items-center">
                                  <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                  {formatTimeLimit(job.timeLimit || 0)}
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                Resources
                              </div>
                              <div className="text-sm">
                                {job.tresInfo ||
                                  "No resource information available"}
                              </div>
                            </div>

                            <div className="pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => onSelectJob(job.jobId)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                                Details
                              </Button>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <div className="flex items-center text-muted-foreground text-sm italic">
                        <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                        No job details available
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{formatTimeAgo(job.startTime)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <span className="font-medium">{job.gpuCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="cursor-pointer">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`px-2 py-0.5 ${getUtilizationColorClass(
                                job.gpuUtilization
                              )}`}
                            >
                              {job.gpuUtilization.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64 p-0">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              GPU Utilization
                            </span>
                            <Badge
                              variant="outline"
                              className={`px-2 py-0.5 ${getUtilizationColorClass(
                                job.gpuUtilization
                              )}`}
                            >
                              {job.gpuUtilization.toFixed(1)}%
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            {job.isNewJob ? (
                              <div className="flex items-center text-xs text-green-500">
                                New job - Using current value
                              </div>
                            ) : (
                              <div className="flex items-center text-xs text-muted-foreground">
                                Running average over{" "}
                                {job.timeWindow || "time period"}
                              </div>
                            )}
                          </div>

                          <div className="pt-1 space-y-2 border-t">
                            <div className="flex justify-between items-center text-xs mt-2">
                              <span>Current utilization:</span>
                              <span className="font-medium">
                                {job.currentUtilization?.toFixed(1)}%
                              </span>
                            </div>

                            {!job.isNewJob && (
                              <div className="flex justify-between items-center text-xs">
                                <span>Historical average:</span>
                                <span className="font-medium">
                                  {job.historicalUtilization?.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                  <TableCell>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="cursor-pointer flex flex-col">
                          <div className="flex items-center">
                            <span
                              className={getUtilizationColorClass(
                                job.memoryUtilization
                              )}
                            >
                              {job.memoryUtilization.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Peak: {job.maxMemoryUtilization.toFixed(1)}%
                          </div>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64 p-0">
                        <div className="p-4 space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Current Memory Usage
                              </span>
                              <Badge
                                variant="outline"
                                className={`px-2 py-0.5 ${getUtilizationColorClass(
                                  job.memoryUtilization
                                )}`}
                              >
                                {job.memoryUtilization.toFixed(1)}%
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Peak Memory Usage
                              </span>
                              <Badge
                                variant="outline"
                                className={`px-2 py-0.5 ${getUtilizationColorClass(
                                  job.maxMemoryUtilization
                                )}`}
                              >
                                {job.maxMemoryUtilization.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>

                          <div className="relative pt-1">
                            <div className="text-xs text-muted-foreground mb-1">
                              Memory Usage
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                              <div
                                style={{ width: `${job.memoryUtilization}%` }}
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                  job.memoryUtilization < 10
                                    ? "bg-red-500"
                                    : job.memoryUtilization < 30
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Peak Usage
                            </div>
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                              <div
                                style={{
                                  width: `${job.maxMemoryUtilization}%`,
                                }}
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                  job.maxMemoryUtilization < 10
                                    ? "bg-red-500"
                                    : job.maxMemoryUtilization < 30
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSelectJob(job.jobId)}
                      className="h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Enhanced pagination controls with jump to page */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-muted/20 p-2 rounded-md">
          <div className="text-sm text-muted-foreground">
            Showing {jobs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
            {Math.min(currentPage * pageSize, totalJobs)} of {totalJobs} jobs
          </div>

          <div className="flex items-center gap-2">
            {/* First page button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || isLoading}
              title="First page"
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Previous page button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              title="Previous page"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Jump to page form */}
            <form
              onSubmit={handleJumpToPage}
              className="flex items-center gap-1"
            >
              <span className="text-sm">Page</span>
              <Input
                className="w-14 h-8 text-center"
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                placeholder={currentPage.toString()}
              />
              <span className="text-sm">of {totalPages}</span>
            </form>

            {/* Next page button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
              title="Next page"
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Last page button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || isLoading}
              title="Last page"
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

// Display name for React DevTools
UnderutilizedJobsTable.displayName = "UnderutilizedJobsTable";

export default UnderutilizedJobsTable;
