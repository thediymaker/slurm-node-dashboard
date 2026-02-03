"use client";
import React, { memo, useMemo, useCallback } from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import {
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hourglass,
  Zap,
} from "lucide-react";
import {
  StateBadge,
  CopyButton,
  EmptyState,
  formatRelativeTime,
  formatDuration,
  formatMemory,
} from "./llm-shared-utils";

interface SlurmJobDetailsProps {
  job: {
    jobs: any[];
    jobStatus?: 'active' | 'completed';
  };
}

const getStatusIcon = (state: string) => {
  switch (state) {
    case 'RUNNING': return <Zap className="w-4 h-4 text-emerald-400" />;
    case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'FAILED': case 'NODE_FAIL': case 'OUT_OF_MEMORY': return <XCircle className="w-4 h-4 text-red-400" />;
    case 'PENDING': return <Hourglass className="w-4 h-4 text-amber-400" />;
    case 'CANCELLED': return <AlertCircle className="w-4 h-4 text-gray-400" />;
    default: return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

function SlurmJobDetailsComponent({ job }: SlurmJobDetailsProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const normalizedJob = useMemo(() => {
    if (!job?.jobs?.length) return null;
    
    const j = job.jobs[0];
    const isHistorical = job.jobStatus === 'completed';
    const jobState = j.job_state || j.state?.current || [];
    const primaryState = jobState[0] || 'UNKNOWN';
    
    return {
      jobId: j.job_id,
      name: j.name || 'Unnamed Job',
      isHistorical,
      jobState,
      primaryState,
      userName: j.user_name || j.user || 'N/A',
      groupName: j.group_name || j.group || 'N/A',
      partition: j.partition || 'N/A',
      nodes: j.nodes || 'N/A',
      startTime: j.start_time?.number || j.time?.start,
      endTime: j.end_time?.number || j.time?.end,
      timeLimit: j.time_limit?.number || j.time?.limit?.number,
      memoryPerNode: j.memory_per_node?.number || j.required?.memory_per_node?.number,
      allocatedCores: j.job_resources?.allocated_cores || j.required?.CPUs || j.cpus?.number || 0,
      command: j.command || j.submit_line || '',
      elapsedTime: j.time?.elapsed,
      exitCode: j.exit_code?.return_code?.number,
      stateReason: j.state?.reason,
    };
  }, [job]);

  if (!normalizedJob) {
    return (
      <EmptyState 
        message="Sorry, I couldn't find any job details for the job ID you provided."
        icon={<AlertCircle className="w-8 h-8 mx-auto" />}
      />
    );
  }

  const { 
    jobId, name, isHistorical, jobState, primaryState, userName, 
    partition, nodes, startTime, endTime, timeLimit, memoryPerNode, 
    allocatedCores, command, elapsedTime, exitCode, stateReason
  } = normalizedJob;

  return (
    <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            {getStatusIcon(primaryState)}
          </div>
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span className="text-muted-foreground">Job</span>
              <span className="text-primary font-mono">{jobId}</span>
              <CopyButton text={String(jobId)} />
            </CardTitle>
            <div className="text-xs text-muted-foreground">{name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {jobState.map((state: string, index: number) => (
            <StateBadge key={index} state={state} type="job" animated={state === 'RUNNING'} />
          ))}
          {isHistorical && (
            <Badge variant="outline" className="text-xs">Historical</Badge>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="p-1.5 hover:bg-muted rounded-full transition-colors ml-1"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
          </motion.button>
        </div>
      </div>

      <Separator />

      <CardContent className="p-4 space-y-3">
        {/* Resources Row */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Partition</div>
            <div className="font-medium text-sm">{partition}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Nodes</div>
            <div className="font-medium text-sm font-mono">{nodes}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">CPUs</div>
            <div className="font-semibold text-primary">{allocatedCores}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Memory</div>
            <div className="font-medium text-sm">{memoryPerNode ? formatMemory(memoryPerNode) : 'N/A'}</div>
          </div>
        </div>

        {/* State Reason - only if present */}
        {stateReason && stateReason !== 'None' && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-muted-foreground">{stateReason}</span>
          </div>
        )}

        {/* Time Info Row */}
        <div className="flex items-center gap-4 text-xs py-2 px-3 bg-muted/30 rounded-lg flex-wrap">
          <span>
            <span className="text-muted-foreground">User:</span>{' '}
            <span className="font-medium">{userName}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Time Limit:</span>{' '}
            <span className="font-medium">{timeLimit ? formatDuration(timeLimit) : '∞'}</span>
          </span>
          {startTime && (
            <>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="text-muted-foreground">Started:</span>{' '}
                <span className="font-medium">{formatRelativeTime(startTime)}</span>
              </span>
            </>
          )}
          {isHistorical && exitCode !== undefined && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className={exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}>
                Exit: {exitCode}
              </span>
            </>
          )}
        </div>

        {/* Command - only if present */}
        {command && (
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Command</span>
              <CopyButton text={command} />
            </div>
            <code className="text-xs font-mono text-muted-foreground break-all block">
              {command.length > 150 ? `${command.slice(0, 150)}...` : command}
            </code>
          </div>
        )}

        {/* Timestamps - compact */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          {startTime && (
            <span>Start: {convertUnixToHumanReadable(startTime)}</span>
          )}
          {isHistorical && endTime && (
            <span>End: {convertUnixToHumanReadable(endTime)}</span>
          )}
          {!isHistorical && elapsedTime && (
            <span>Elapsed: {formatDuration(elapsedTime / 60)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const SlurmJobDetails = memo(SlurmJobDetailsComponent);
export default SlurmJobDetails;
