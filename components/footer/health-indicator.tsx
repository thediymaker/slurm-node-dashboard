"use client";

import { useMemo } from "react";
import { SlurmDiag } from "@/types/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Server,
  Clock,
  Zap,
} from "lucide-react";

// Moved outside component to avoid recreation
const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

interface HealthIndicatorProps {
  data?: SlurmDiag;
  isLoading: boolean;
  error?: any;
  hasStaleData?: boolean;
}

export function HealthIndicator({
  data,
  isLoading,
  error,
  hasStaleData: hasStaleDataProp,
}: HealthIndicatorProps) {
  // Check if we have stale data - use prop if provided, otherwise infer from error + data
  const hasStaleData = hasStaleDataProp ?? (error && data);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Activity className="h-3 w-3 animate-pulse" />
        <span>System Status: Checking...</span>
      </div>
    );
  }

  // Show stale data warning when we have cached data but refresh failed
  if (hasStaleData) {
    return (
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-xs">
        <AlertTriangle className="h-3 w-3" />
        <span>Cached</span>
      </div>
    );
  }

  // Show connection error when we have no data at all
  if (error && !data) {
    const isConnectionError = error.message?.includes("Unable to contact Slurm controller") ||
                               error.message?.includes("service may be down") ||
                               error.message?.includes("ECONNREFUSED");
    return (
      <div className="flex items-center gap-2 text-destructive text-xs">
        <XCircle className="h-3 w-3" />
        <span>{isConnectionError ? "Slurm Controller Unreachable" : "System Status: Error"}</span>
      </div>
    );
  }

  // If no data available, show unknown status
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Activity className="h-3 w-3" />
        <span>System Status: Unknown</span>
      </div>
    );
  }

  // Memoize status calculation to avoid recalculating on every render
  const { status, errors, warnings, isHeavyLoad } = useMemo(() => {
    const errs = data.errors || [];
    const warns = data.warnings || [];
    const cycleMean = data.statistics?.schedule_cycle_mean || 0;
    const agentQueue = data.statistics?.agent_queue_size || 0;

    // Heavy load is informational, not a warning - agent queue > 500 indicates busy cluster
    const heavyLoad = agentQueue > 500;

    let s: "healthy" | "warning" | "critical" | "busy" = "healthy";
    if (errs.length > 0) {
      s = "critical";
    } else if (warns.length > 0 || cycleMean > 100000) {
      s = "warning";
    } else if (heavyLoad) {
      s = "busy";
    }

    return { status: s, errors: errs, warnings: warns, isHeavyLoad: heavyLoad };
  }, [data]);

  const color = {
    healthy: "text-green-600 dark:text-green-500",
    busy: "text-blue-600 dark:text-blue-500",
    warning: "text-amber-600 dark:text-amber-500",
    critical: "text-red-600 dark:text-red-500",
  }[status];

  const Icon = {
    healthy: CheckCircle2,
    busy: Activity,
    warning: AlertTriangle,
    critical: XCircle,
  }[status];

  const statusLabel = {
    healthy: "HEALTHY",
    busy: "BUSY",
    warning: "WARNING",
    critical: "CRITICAL",
  }[status];

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div
          className={`flex items-center gap-2 cursor-help transition-colors hover:bg-muted/50 px-2 py-1 rounded-md`}
        >
          <Icon className={`h-3 w-3 ${color}`} />
          <span className={`${color} font-semibold uppercase`}>
            {statusLabel}
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${color}`} />
              <h4 className="font-semibold">System Diagnostics</h4>
            </div>
            <span className="text-xs text-muted-foreground">
              Last Updated: {new Date().toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Scheduler Cycle (Mean)
              </span>
              <span className="font-mono text-sm font-medium">
                {formatNumber(data.statistics.schedule_cycle_mean)} μs
              </span>
            </div>
            <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Latency (GetTimeOfDay)
              </span>
              <span className="font-mono text-sm font-medium">
                {formatNumber(data.statistics.gettimeofday_latency)} μs
              </span>
            </div>
            <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Server className="h-3 w-3" /> Schedule Queue
              </span>
              <span className="font-mono text-sm font-medium">
                {formatNumber(data.statistics.schedule_queue_length)}
              </span>
            </div>
            <div className={`flex flex-col gap-1 p-2 rounded-md border ${isHeavyLoad ? 'bg-blue-500/10 border-blue-500/30' : 'bg-muted/50'}`}>
              <span className={`flex items-center gap-1 ${isHeavyLoad ? 'text-blue-500' : 'text-muted-foreground'}`}>
                <Activity className="h-3 w-3" /> Agent Queue
                {isHeavyLoad && <span className="text-[10px] ml-1">(Heavy Load)</span>}
              </span>
              <span className={`font-mono text-sm font-medium ${isHeavyLoad ? 'text-blue-500' : ''}`}>
                {formatNumber(data.statistics.agent_queue_size)}
              </span>
            </div>
             <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" /> Backfill Depth
              </span>
              <span className="font-mono text-sm font-medium">
                {formatNumber(data.statistics.bf_depth_mean)} / {formatNumber(data.statistics.bf_queue_len)}
              </span>
            </div>
             <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-md border">
              <span className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" /> Backfill Last Cycle
              </span>
              <span className="font-mono text-sm font-medium">
                 {formatNumber(data.statistics.bf_last_depth)}
              </span>
            </div>
          </div>

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="rounded-md border bg-muted/30 p-2 space-y-2">
              {errors.length > 0 && (
                <div className="space-y-1">
                    <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Critical Errors
                    </span>
                   <ul className="list-disc list-inside text-xs text-destructive">
                       {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                       {errors.length > 3 && <li>+{errors.length - 3} more</li>}
                   </ul>
                </div>
              )}
               {warnings.length > 0 && (
                <div className="space-y-1">
                    <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Warnings
                    </span>
                   <ul className="list-disc list-inside text-xs text-amber-600/90 dark:text-amber-500/90">
                       {warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                       {warnings.length > 3 && <li>+{warnings.length - 3} more</li>}
                   </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
