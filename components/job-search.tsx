"use client";
import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Form, FormField, FormItem } from "./ui/form";
import { useForm } from "react-hook-form";
import { Button } from "./ui/button";
import JobDetailModal from "./modals/job-detail-modal";
import UserJobModal from "./modals/user-job-modal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import MaintModal from "./modals/maint-modal";

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
  const [userJobOpen, setUserJobOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState({});
  const [searchID, setSearchID] = useState("");
  const { errors } = form.formState;

  const handleSearch = (data: SearchFormData) => {
    const trimmedSearchID = data.searchID.trim();
    setSearchID(trimmedSearchID);
    if (/^\d+$/.test(trimmedSearchID)) {
      setJobOpen(true);
      setUserJobOpen(false);
    } else {
      setJobOpen(false);
      setUserJobOpen(true);
    }
    form.reset();
  };

  const fetchMaintenanceData = async () => {
    try {
      const response = await fetch(`/api/slurm/reservations`, {
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
          setMaintOpen(data.reservations?.length > 0);
        }
      } else {
        setMaintOpen(data.reservations?.length > 0);
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
                  />
                </div>
              </FormItem>
            )}
          />
          <Button className="px-5" variant={"outline"} type="submit">
            Search
          </Button>
        </form>
      </Form>
      {jobOpen && (
        <JobDetailModal
          open={jobOpen}
          setOpen={setJobOpen}
          searchID={searchID}
        />
      )}
      {userJobOpen && (
        <UserJobModal
          open={userJobOpen}
          setOpen={setUserJobOpen}
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
