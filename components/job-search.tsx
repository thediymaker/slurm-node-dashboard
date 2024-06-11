"use client";
import { useState } from "react";
import { Input } from "./ui/input";
import { Form, FormField, FormItem } from "./ui/form";
import { useForm } from "react-hook-form";
import { Button } from "./ui/button";
import JobCardModal from "./modals/job-modal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const JobSearch = () => {
  const jobIdSchema = z.object({
    jobID: z
      .string()
      .regex(
        /^\s*\d+\s*$/,
        "Job ID must be numeric and can have leading and trailing spaces"
      )
      .min(2, "Job ID must be at least 2 digits long"),
  });

  type JobIdFormData = z.infer<typeof jobIdSchema>;

  const form = useForm<JobIdFormData>({
    resolver: zodResolver(jobIdSchema),
    defaultValues: { jobID: "" },
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState("");
  const { errors } = form.formState;

  const handleSearch = (data: JobIdFormData) => {
    const trimmedJobID = data.jobID.trim();
    setJobId(trimmedJobID);
    setOpen(true);
    setSearch("");
    form.reset();
  };

  return (
    <div>
      <Form {...form}>
        <form
          className="flex items-center gap-2"
          onSubmit={form.handleSubmit(handleSearch)}
        >
          <FormField
            control={form.control}
            name="jobID"
            render={({ field }) => (
              <FormItem>
                <div className="flex pr-2">
                  <Input
                    type="text"
                    placeholder="Search by Job ID"
                    {...field}
                    value={field.value ?? ""}
                    className={`w-full px-2 py-1 text-sm ${
                      errors.jobID ? "border-red-500" : ""
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
      {open && <JobCardModal open={open} setOpen={setOpen} jobId={jobId} />}
    </div>
  );
};

export default JobSearch;
