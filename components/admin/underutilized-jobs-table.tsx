import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobData {
  jobId: string;
  gpuUtilization: number;
  memoryUtilization: number;
  maxMemoryUtilization: number;
  startTime: number;
  gpuCount: number;
}

interface UnderutilizedJobsTableProps {
  searchQuery?: string;
  onSelectJob: (jobId: string) => void;
  threshold?: number;
}

export default function UnderutilizedJobsTable({
  searchQuery = "",
  onSelectJob,
  threshold = 30,
}: UnderutilizedJobsTableProps) {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [pageSize] = useState(10);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [jumpToPage, setJumpToPage] = useState("");

  useEffect(() => {
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

        console.log(
          `Fetching page ${currentPage} with offset ${offset}: ${url}`
        );
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
        setError(
          err instanceof Error ? err.message : "Failed to load job data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();

    // Set up interval to refresh data every minute
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
  }, [currentPage, pageSize, searchQuery, threshold, sortOrder]);

  // Calculate total pages
  const totalPages = Math.ceil(totalJobs / pageSize);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, threshold]);

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

  // Format time ago for display
  const formatTimeAgo = (timestamp: number) => {
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true });
    } catch (e) {
      return "Unknown";
    }
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
            <TableRow>
              <TableHead>Job ID</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>GPU Count</TableHead>
              <TableHead className="cursor-pointer" onClick={toggleSort}>
                <span className="flex items-center">
                  Avg. Utilization {getSortIcon()}
                </span>
              </TableHead>
              <TableHead>Memory Usage</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchQuery
                    ? "No matching jobs found"
                    : "No underutilized jobs found"}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.jobId}>
                  <TableCell className="font-medium">{job.jobId}</TableCell>
                  <TableCell>{formatTimeAgo(job.startTime)}</TableCell>
                  <TableCell>{job.gpuCount}</TableCell>
                  <TableCell>
                    <Badge variant={getUtilizationSeverity(job.gpuUtilization)}>
                      {job.gpuUtilization.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{job.memoryUtilization.toFixed(1)}%</span>
                      <span className="text-xs text-muted-foreground">
                        Peak: {job.maxMemoryUtilization.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onSelectJob(job.jobId)}
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
        <div className="flex items-center justify-between">
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
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
