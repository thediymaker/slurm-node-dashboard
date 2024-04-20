"use client";
import SystemHealth from "@/components/layout/systemHealth";
import useSWR from "swr";

// Separate fetching logic into a dedicated function.
const fetcher = () =>
  fetch("/api/slurm/diag", {
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());

const Footer = ({ cluster, logo }: any) => {
  const { data, error } = useSWR("/api/slurm/diag", fetcher, {
    refreshInterval: 10000,
  });

  if (!data && !error) return <div>Loading...</div>;
  if (error) return <div>Failed to load cluster status information.</div>;

  const healthStatus = data.errors.length > 0 ? "unhealthy" : "healthy";

  return (
    <div className="fixed inset-x-0 bottom-0 dark:bg-background border-t-2 border-b-2 text-card-foreground bg-gray-300">
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
