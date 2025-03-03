// components/admin/JobMetricsDashboard.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderIcon, SearchIcon } from "lucide-react";
import JobMetricsSummary from "./job-metrics-summary";
import UnderutilizedJobsTable from "./underutilized-jobs-table";
import JobDetailsPanel from "./job-details-panel";
import { useDebounce } from "@/hooks/use-debounce";

export default function JobMetricsDashboard() {
  const [activeTab, setActiveTab] = useState("summary");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<"1d" | "7d" | "30d">("1d");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Handle search input change
  const handleSearch = (e: any) => {
    setSearchQuery(e.target.value);

    // If the search looks like a job ID and user presses Enter, select that job
    if (e.key === "Enter" && e.target.value.trim()) {
      setSelectedJobId(e.target.value.trim());
      setActiveTab("job-details");
    }
  };

  // Handle job selection
  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab("job-details");
  };

  // Handle time period change
  const handleTimePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimePeriod(e.target.value as "1d" | "7d" | "30d");
  };

  // Force refresh all data
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by job ID..."
              className="pl-8"
              value={searchQuery}
              onChange={handleSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  setSelectedJobId(searchQuery.trim());
                  setActiveTab("job-details");
                }
              }}
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            title="Refresh data"
          >
            <LoaderIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View period:</span>
          <select
            className="bg-background border rounded px-2 py-1 text-sm"
            value={timePeriod}
            onChange={handleTimePeriodChange}
          >
            <option value="1d">1 Day</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </select>
        </div>
      </div>

      <Tabs
        defaultValue="summary"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="underutilized">Underutilized Jobs</TabsTrigger>
          <TabsTrigger value="job-details">Job Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <JobMetricsSummary
            key={isLoading ? "loading-summary" : "loaded-summary"}
          />
        </TabsContent>

        <TabsContent value="underutilized" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Underutilized Jobs</CardTitle>
              <CardDescription>
                Jobs with average GPU utilization below 30% over the selected
                time period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UnderutilizedJobsTable
                key={`${
                  isLoading ? "loading" : "loaded"
                }-underutilized-${debouncedSearch}`}
                searchQuery={debouncedSearch}
                onSelectJob={handleSelectJob}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job-details" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>
                {selectedJobId
                  ? `Detailed metrics for job ${selectedJobId}`
                  : "Select a job to view detailed metrics"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedJobId ? (
                <JobDetailsPanel
                  key={`${selectedJobId}-${isLoading ? "loading" : "loaded"}`}
                  jobId={selectedJobId}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>
                    Enter a job ID in the search bar or select a job from the
                    Underutilized Jobs tab
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedJobId && activeTab !== "job-details" && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Job {selectedJobId} selected</h3>
                <p className="text-sm text-muted-foreground">
                  View detailed metrics for this job
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setActiveTab("job-details")}
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
