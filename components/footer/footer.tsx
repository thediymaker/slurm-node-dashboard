"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { HealthIndicator } from "./health-indicator";
import { SlurmDiag } from "@/types/types";
import { Box } from "lucide-react";

// Fetcher function with error handling
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

interface FooterProps {
  cluster?: string;
  logo?: string;
}

const Footer = ({ cluster = "Cluster", logo }: FooterProps) => {
  const { data, error, isLoading } = useSWR<SlurmDiag>(
    "/api/slurm/diag",
    fetcher,
    {
      refreshInterval: 15000,
    }
  );

  const stats = useMemo(() => {
    if (isLoading || !data) {
      return { jobsRunning: null, jobsPending: null, slurmRelease: null };
    }
    return {
      jobsRunning: data.statistics?.jobs_running ?? "N/A",
      jobsPending: data.statistics?.jobs_pending ?? "N/A",
      slurmRelease: data.meta?.slurm?.release ?? "Unknown",
    };
  }, [data, isLoading]);

  const { jobsRunning, jobsPending, slurmRelease } = stats;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
      <div className="flex h-10 items-center justify-between px-4 text-sm font-medium">
        {/* Left Side: Identity & Health */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 select-none">
            {logo && <img src={logo} alt="Logo" className="h-5 w-5 object-contain" />}
            <span className="text-primary font-bold uppercase tracking-wider text-xs hidden sm:block">
              {cluster}
            </span>
          </div>
          
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          
          <HealthIndicator 
            data={data} 
            isLoading={isLoading} 
            error={error} 
          />
        </div>

        {/* Right Side: Metrics & Info */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-4 text-muted-foreground">
            {isLoading ? (
              <>
                 <Skeleton className="h-4 w-16" />
                 <Skeleton className="h-4 w-16" />
              </>
            ) : error ? (
                <span className="text-xs text-destructive">Unavailable</span>
            ) : (
              <>
                <div 
                  className="flex items-center gap-2" 
                  title="Running Jobs"
                >
                  <span className="flex h-1.5 w-1.5 rounded-full bg-foreground/50" />
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Running</span>
                  <span className="font-mono text-xs font-medium">{jobsRunning}</span>
                </div>
                
                <div 
                  className="flex items-center gap-2" 
                  title="Pending Jobs"
                >
                  <span className="flex h-1.5 w-1.5 rounded-full bg-foreground/25" />
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Pending</span>
                  <span className="font-mono text-xs font-medium">{jobsPending}</span>
                </div>
              </>
            )}
          </div>

          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          {/* Version Info */}
          <div 
            className="hidden sm:flex items-center gap-1.5 text-muted-foreground" 
            title={`Slurm Release: ${slurmRelease}`}
          >
            <Box className="h-3.5 w-3.5" />
            {isLoading ? (
                 <Skeleton className="h-3 w-10" />
            ) : (
                <span className="text-xs font-mono">v{slurmRelease}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
