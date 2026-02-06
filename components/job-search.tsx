"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import JobDetailModal from "./modals/job-detail-modal";
import HistoricalJobDetailModal from "./modals/historical-job-detail-modal";
import UserJobModal from "./modals/user-job-modal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import MaintModal from "./modals/maint-modal";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const searchSchema = z.object({
  searchID: z
    .string()
    .regex(/^\s*[a-zA-Z0-9]+\s*$/, "Username or Job ID only")
    .min(2, "Username or Job ID must be at least 2 characters long"),
});

type SearchFormData = z.infer<typeof searchSchema>;

interface MaintenanceData {
  reservations?: Array<{
    flags?: string[] | string;
    [key: string]: unknown;
  }>;
}

const JobSearch = () => {
  const { toast } = useToast();

  const form = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: { searchID: "" },
  });

  const [jobOpen, setJobOpen] = useState(false);
  const [historicalJobOpen, setHistoricalJobOpen] = useState(false);
  const [userJobOpen, setUserJobOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData>({});
  const [searchID, setSearchID] = useState("");
  const { errors } = form.formState;

  const handleSearch = useCallback(
    async (data: SearchFormData) => {
      // Prevent duplicate searches while loading
      if (searchLoading) return;

      setSearchLoading(true);
      const trimmedSearchID = data.searchID.trim();
      setSearchID(trimmedSearchID);

      try {
        if (/^\d+$/.test(trimmedSearchID)) {
          // Fetch active and completed jobs in parallel for better performance
          const [activeJobResult, completedJobResult] = await Promise.allSettled([
            fetch(`/api/slurm/job/${trimmedSearchID}`, {
              headers: { "Content-Type": "application/json" },
            }).then((res) => res.json()),
            fetch(`/api/slurm/job/completed/${trimmedSearchID}`, {
              headers: { "Content-Type": "application/json" },
            }).then((res) => res.json()),
          ]);

          // Check active job result first (prioritize running/pending jobs)
          if (activeJobResult.status === "fulfilled") {
            const activeJobData = activeJobResult.value;
            if (activeJobData?.jobs && Array.isArray(activeJobData.jobs) && activeJobData.jobs.length > 0) {
              const jobState = activeJobData.jobs[0].job_state?.[0];
              // Show modal for running, pending, and completing jobs
              if (jobState === "RUNNING" || jobState === "COMPLETING" || jobState === "PENDING") {
                setJobOpen(true);
                return;
              }
            }
          }

          // Check completed job result
          if (completedJobResult.status === "fulfilled") {
            const completedJobData = completedJobResult.value;
            if (completedJobData?.jobs && Array.isArray(completedJobData.jobs) && completedJobData.jobs.length > 0) {
              const jobState = completedJobData.jobs[0].state?.current?.[0];

              // If job is pending in completed DB, still show active modal
              if (jobState === "PENDING") {
                setJobOpen(true);
                return;
              }

              // Open historical modal for completed/cancelled/failed jobs
              setHistoricalJobOpen(true);
              return;
            }
          }

          // If neither active nor completed job is found
          toast({
            title: "Not Found",
            description: "No job found with the given ID.",
            variant: "destructive",
          });
        } else {
          // Search by username
          setUserJobOpen(true);
        }
      } catch (error) {
        console.error("Error during search:", error);
        toast({
          title: "Search Error",
          description: "An error occurred during search. Please try again.",
          variant: "destructive",
        });
      } finally {
        setSearchLoading(false);
        form.reset();
      }
    },
    [searchLoading, form, toast]
  );

  const fetchMaintenanceData = useCallback(async () => {
    try {
      const response = await fetch(`/api/slurm/reservations`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        // Silently fail for connection errors - this is expected when Slurm is unreachable
        return;
      }

      const data = await response.json();
      const maintReservations = (data?.reservations ?? []).filter(
        (r: { flags?: string[] | string;[key: string]: unknown }) => {
          const flags = r?.flags;
          if (Array.isArray(flags)) return flags.includes("MAINT");
          if (typeof flags === "string") return flags.includes("MAINT");
          return false;
        }
      );

      const filtered = { ...data, reservations: maintReservations };
      setMaintenanceData(filtered);

      const lastClosedTimestamp = localStorage.getItem("maintModalLastClosed");
      const now = Date.now();

      if (lastClosedTimestamp) {
        const elapsed = now - parseInt(lastClosedTimestamp, 10);
        if (elapsed > 24 * 60 * 60 * 1000) {
          setMaintOpen(maintReservations.length > 0);
        }
      } else {
        setMaintOpen(maintReservations.length > 0);
      }
    } catch {
      // Silently fail - maintenance data is non-critical
    }
  }, []);

  useEffect(() => {
    fetchMaintenanceData();
  }, []);

  const handleMaintClose = () => {
    setMaintOpen(false);
    const now = new Date().getTime();
    localStorage.setItem("maintModalLastClosed", now.toString());
  };

  return (
    <div>
      <Form {...form}>
        <form
          className="flex items-center"
          onSubmit={form.handleSubmit(handleSearch)}
        >
          <FormField
            control={form.control}
            name="searchID"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2 w-[180px]">
                  <Input
                    type="text"
                    placeholder="Search by username or job ID"
                    {...field}
                    value={field.value ?? ""}
                    className={`w-full px-2 py-1 text-sm ${errors.searchID ? "border-red-500" : ""
                      }`}
                    disabled={searchLoading}
                  />
                </div>
              </FormItem>
            )}
          />
          <Button
            className="h-9 w-9 p-0 relative"
            variant="outline"
            type="submit"
            disabled={searchLoading}
            title="Search"
          >
            {searchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>
      </Form>

      {jobOpen && (
        <JobDetailModal
          open={jobOpen}
          setOpen={(open) => {
            setJobOpen(open);
            setSearchLoading(false);
          }}
          searchID={searchID}
        />
      )}
      {historicalJobOpen && (
        <HistoricalJobDetailModal
          open={historicalJobOpen}
          setOpen={(open) => {
            setHistoricalJobOpen(open);
            setSearchLoading(false);
          }}
          searchID={searchID}
        />
      )}
      {userJobOpen && (
        <UserJobModal
          open={userJobOpen}
          setOpen={(open: boolean | ((prevState: boolean) => boolean)) => {
            setUserJobOpen(open);
            setSearchLoading(false);
          }}
          searchID={searchID}
        />
      )}
      {maintOpen && (
        <MaintModal
          open={maintOpen}
          setOpen={handleMaintClose}
          maintenanceData={maintenanceData}
        />
      )}
    </div>
  );
};

export default JobSearch;
