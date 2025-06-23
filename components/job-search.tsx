"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";

const JobSearch = () => {
  const searchSchema = z.object({
    searchID: z
      .string()
      .regex(/^\s*[a-zA-Z0-9]+\s*$/, "Username or Job ID only")
      .min(2, "Username or Job ID must be at least 2 characters long"),
  });

  type SearchFormData = z.infer<typeof searchSchema>;

  const form = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: { searchID: "" },
  });

  const [jobOpen, setJobOpen] = useState(false);
  const [historicalJobOpen, setHistoricalJobOpen] = useState(false);
  const [userJobOpen, setUserJobOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState({});
  const [searchID, setSearchID] = useState("");
  const { errors } = form.formState;

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";
  const handleSearch = async (data: SearchFormData) => {
    // Prevent duplicate searches while loading
    if (searchLoading) return;

    setSearchLoading(true);

    const trimmedSearchID = data.searchID.trim();
    setSearchID(trimmedSearchID);

    try {
      if (/^\d+$/.test(trimmedSearchID)) {
        // Check for active job
        try {
          const activeJobResponse = await fetch(
            `${baseURL}/api/slurm/job/${trimmedSearchID}`,
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          const activeJobData = await activeJobResponse.json();

          if (
            activeJobData &&
            activeJobData.jobs &&
            activeJobData.jobs.length > 0
          ) {
            const jobState = activeJobData.jobs[0].job_state[0];
            if (jobState === "RUNNING") {
              setJobOpen(true);
              setHistoricalJobOpen(false);
              setUserJobOpen(false);
              form.reset();
              setSearchLoading(false);
              return;
            } else if (jobState === "PENDING") {
              alert(
                "Job is currently pending, Reason: " +
                  activeJobData.jobs[0].state_reason
              );
              form.reset();
              setSearchLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error("Error fetching active job:", error);
        }

        // Check for completed job
        try {
          const completedJobResponse = await fetch(
            `/api/slurm/job/completed/${trimmedSearchID}`,
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          const completedJobData = await completedJobResponse.json();

          if (
            completedJobData &&
            completedJobData.jobs &&
            completedJobData.jobs.length > 0
          ) {
            setHistoricalJobOpen(true);
            setJobOpen(false);
            setUserJobOpen(false);
            form.reset();
            setSearchLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error fetching completed job:", error);
        }

        // If neither active nor completed job is found
        alert("No job found with the given ID.");
      } else {
        // Search by username
        setUserJobOpen(true);
        setJobOpen(false);
        setHistoricalJobOpen(false);
      }
    } catch (error) {
      console.error("Error during search:", error);
      alert("An error occurred during search. Please try again.");
    } finally {
      setSearchLoading(false);
      form.reset();
    }
  };

  const fetchMaintenanceData = async () => {
    try {
      const response = await fetch(`${baseURL}/api/slurm/reservations`, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();
      setMaintenanceData(data);

      const lastClosedTimestamp = localStorage.getItem("maintModalLastClosed");
      const now = new Date().getTime();

      if (lastClosedTimestamp) {
        const elapsed = now - parseInt(lastClosedTimestamp, 10);
        if (elapsed > 24 * 60 * 60 * 1000) {
          setMaintOpen(
            data.reservations?.length > 0 &&
              data.reservations[0].flags.includes("MAINT")
          );
        }
      } else {
        setMaintOpen(
          data.reservations?.length > 0 &&
            data.reservations[0].flags.includes("MAINT")
        );
      }
    } catch (error) {
      console.error("Error fetching maintenance data:", error);
    }
  };

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
                <div className="flex pr-2 w-[250px]">
                  <Input
                    type="text"
                    placeholder="Search by username or job ID"
                    {...field}
                    value={field.value ?? ""}
                    className={`w-full px-2 py-1 text-sm ${
                      errors.searchID ? "border-red-500" : ""
                    }`}
                    disabled={searchLoading}
                  />
                </div>
              </FormItem>
            )}
          />
          <Button
            className="px-5 min-w-[100px]"
            variant="outline"
            type="submit"
            disabled={searchLoading}
          >
            {searchLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Search"
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
