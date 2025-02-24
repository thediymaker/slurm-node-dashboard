"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import GpuUtilizationReport from "./reports/gpu-utilization-report";
import JobEfficiencyReport from "./reports/job-efficiency-report";
import QueueTimesReport from "./reports/queue-times-report";
import ReportLoading from "./reports/report-loading";

// Define form schema for query parameters
const queryFormSchema = z.object({
  dataSource: z.enum(["influxdb", "prometheus"]),
  metric: z.string().min(1, { message: "Please select a metric" }),
  timeRange: z.object({
    from: z.date(),
    to: z.date(),
  }),
  filters: z.string().optional(),
});

type QueryFormValues = z.infer<typeof queryFormSchema>;

const ReportsPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [activeReport, setActiveReport] = useState<string>("gpu-utilization");

  // Initialize form with default values
  const form = useForm<QueryFormValues>({
    resolver: zodResolver(queryFormSchema),
    defaultValues: {
      dataSource: "prometheus",
      metric: "gpu_utilization",
      timeRange: {
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        to: new Date(),
      },
      filters: "",
    },
  });

  const onSubmit = async (data: QueryFormValues) => {
    setIsLoading(true);
    try {
      // Format date for API
      const from = Math.floor(data.timeRange.from.getTime() / 1000);
      const to = Math.floor(data.timeRange.to.getTime() / 1000);

      const apiUrl =
        data.dataSource === "prometheus"
          ? `/api/prometheus/query`
          : `/api/influxdb/query`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metric: data.metric,
          from,
          to,
          filters: data.filters,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const result = await response.json();
      setReportData(result.data);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Slurm Analytics Dashboard</CardTitle>
          <CardDescription>
            Monitor job performance, resource utilization, and queue metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="predefined" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="predefined">Predefined Reports</TabsTrigger>
              <TabsTrigger value="custom">Custom Query</TabsTrigger>
            </TabsList>

            <TabsContent value="predefined" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                  className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    activeReport === "gpu-utilization"
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => setActiveReport("gpu-utilization")}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">GPU Utilization</CardTitle>
                    <CardDescription>
                      Track underutilized GPU resources in jobs
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    activeReport === "job-efficiency"
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => setActiveReport("job-efficiency")}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">Job Efficiency</CardTitle>
                    <CardDescription>
                      CPU and memory usage efficiency metrics
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    activeReport === "queue-times" ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setActiveReport("queue-times")}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">Queue Times</CardTitle>
                    <CardDescription>
                      Job wait times by partition and QoS
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">
                      {activeReport === "gpu-utilization" &&
                        "GPU Utilization Report"}
                      {activeReport === "job-efficiency" &&
                        "Job Efficiency Report"}
                      {activeReport === "queue-times" && "Queue Times Report"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ReportLoading />
                  ) : (
                    <div>
                      {activeReport === "gpu-utilization" && (
                        <GpuUtilizationReport data={reportData} />
                      )}
                      {activeReport === "job-efficiency" && (
                        <JobEfficiencyReport data={reportData} />
                      )}
                      {activeReport === "queue-times" && (
                        <QueueTimesReport data={reportData} />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custom">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dataSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Source</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a data source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="prometheus">
                                Prometheus
                              </SelectItem>
                              <SelectItem value="influxdb">InfluxDB</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the data source for your query
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="metric"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metric</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a metric" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="gpu_utilization">
                                GPU Utilization
                              </SelectItem>
                              <SelectItem value="job_memory_usage">
                                Job Memory Usage
                              </SelectItem>
                              <SelectItem value="job_cpu_usage">
                                Job CPU Usage
                              </SelectItem>
                              <SelectItem value="queue_wait_time">
                                Queue Wait Time
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the metric you want to query
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="timeRange.from"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>From</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timeRange.to"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>To</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="filters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filters (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. job_id=1234567 or node=compute-01"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Add additional filters in the format key=value
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Loading..." : "Run Query"}
                  </Button>
                </form>
              </Form>

              {reportData && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Query Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
                      {JSON.stringify(reportData, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPanel;
