"use client";
import SystemHealth from "@/components/footer/systemHealth";
import useSWR from "swr";
import { Skeleton } from "../ui/skeleton";

// Updated fetcher function with error handling
const fetcher = async () => {
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";
  const response = await fetch(`${baseURL}/api/slurm/diag`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const Footer = ({ cluster, logo }: any) => {
  const { data, error, isLoading } = useSWR("/api/slurm/diag", fetcher, {
    refreshInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-b-2 text-card-foreground bg-background">
        <div className="text-sm font-bold flex justify-between items-center p-2 mx-auto">
          <div className="flex items-center space-x-5">
            <img src={logo} alt="Logo" className="w-8 h-8" />
            <span className="text-blue-400 uppercase">{cluster}</span>
            <span>Current System Status:</span>
            <Skeleton className="w-12 h-4" />
            <span>Slurm Release:</span>
            <Skeleton className="w-10 h-4" />
          </div>
          <div className="flex gap-1 items-center">
            Running Jobs: <Skeleton className="w-10 h-4" /> | Pending Jobs:{" "}
            <Skeleton className="w-10 h-4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-b-2 text-card-foreground bg-background">
        <div className="text-sm font-bold flex justify-between items-center p-2 mx-auto text-red-500">
          <div className="flex items-center space-x-5">
            <img src={logo} alt="Logo" className="w-8 h-8" />
            <span className="text-blue-400 uppercase">{cluster}</span>
            <span>
              Error: Unable to fetch system status. Please try again later.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const healthStatus =
    data.errors && data.errors.length > 0 ? "unhealthy" : "healthy";
  const jobsRunning = data.statistics?.jobs_running ?? "N/A";
  const jobsPending = data.statistics?.jobs_pending ?? "N/A";
  const slurmRelease = data.meta?.slurm?.release ?? "Unknown";

  return (
    <div className="fixed inset-x-0 bottom-0 border-t-2 border-b-2 text-card-foreground bg-background">
      <div className="text-sm font-bold flex justify-between items-center p-2 mx-auto">
        <div className="flex items-center space-x-5">
          <img src={logo} alt="Logo" className="w-8 h-8" />
          <span className="text-blue-400 uppercase">{cluster}</span>
          <span>Current System Status:</span>
          <SystemHealth status={healthStatus} />
          <span>Slurm Release: {slurmRelease}</span>
        </div>
        <div>
          Running Jobs: {jobsRunning} | Pending Jobs: {jobsPending}
        </div>
      </div>
    </div>
  );
};

export default Footer;
