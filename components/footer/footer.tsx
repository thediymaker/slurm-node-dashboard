"use client";
import SystemHealth from "@/components/footer/systemHealth";
import useSWR from "swr";
import { Skeleton } from "../ui/skeleton";

// Separate fetching logic into a dedicated function.
const fetcher = () =>
  fetch("/api/slurm/diag", {
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());

const Footer = ({ cluster, logo }: any) => {
  const { data, error } = useSWR("/api/slurm/diag", fetcher, {
    refreshInterval: 15000,
  });

  if (!data && !error)
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
  if (error) return <div>Something went wrong.</div>;

  const healthStatus = data.errors.length > 0 ? "unhealthy" : "healthy";

  return (
    <div className="fixed inset-x-0 bottom-0 border-t-2 border-b-2 text-card-foreground bg-background">
      <div className="text-sm font-bold flex justify-between items-center p-2 mx-auto">
        <div className="flex items-center space-x-5">
          <img src={logo} alt="Logo" className="w-8 h-8" />
          <span className="text-blue-400 uppercase">{cluster}</span>
          <span>Current System Status:</span>
          <SystemHealth status={healthStatus} />
          <span>Slurm Release: {data.meta.slurm.release}</span>
        </div>
        <div>
          Running Jobs: {data.statistics.jobs_running} | Pending Jobs:{" "}
          {data.statistics.jobs_pending}
        </div>
      </div>
    </div>
  );
};

export default Footer;
