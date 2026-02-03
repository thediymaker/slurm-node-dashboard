"use client";
import React, { memo, useMemo } from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  AlertCircle,
  Infinity,
} from "lucide-react";
import {
  CopyButton,
  EmptyState,
  formatDuration,
} from "./llm-shared-utils";

interface SlurmQosDetailsProps {
  qos: {
    qos: any[];
  };
}

// Extract value from nested Slurm format like { set: bool, infinite: bool, number: n }
const extractLimit = (val: unknown): string | number => {
  if (val === undefined || val === null) return '∞';
  if (typeof val === 'object' && val !== null) {
    const obj = val as { set?: boolean; infinite?: boolean; number?: number };
    if (obj.infinite === true || obj.set === false) return '∞';
    if (typeof obj.number === 'number') return obj.number === -1 ? '∞' : obj.number;
  }
  if (typeof val === 'number') return val === -1 ? '∞' : val;
  return '∞';
};

function SlurmQosDetailsComponent({ qos }: SlurmQosDetailsProps) {
  const qosData = useMemo(() => {
    if (!qos?.qos?.length) return null;
    
    const q = qos.qos[0];
    
    // Extract priority
    const priority = extractLimit(q.priority);
    
    // Extract limits from nested structure
    const limits = q.limits || {};
    const maxLimits = limits.max || {};
    
    // Max active jobs per user
    const maxJobsPerUser = extractLimit(maxLimits.jobs?.active_jobs?.per?.user);
    // Max submit per user  
    const maxSubmitPerUser = extractLimit(maxLimits.jobs?.per?.user);
    // Max wall time per job
    const maxWallPerJob = extractLimit(maxLimits.wall_clock?.per?.job);
    // Grace time
    const graceTime = extractLimit(limits.grace_time);
    // Usage factor
    const usageFactor = extractLimit(q.usage_factor);
    
    // Preempt mode
    const preemptMode = q.preempt?.mode || [];
    const preemptExemptTime = extractLimit(q.preempt?.exempt_time);
    
    return {
      name: q.name || 'Unknown',
      description: q.description || '',
      priority,
      maxJobsPerUser,
      maxSubmitPerUser,
      maxWallPerJob,
      graceTime,
      usageFactor,
      preemptMode,
      preemptExemptTime,
      flags: q.flags || [],
    };
  }, [qos]);

  if (!qosData) {
    return (
      <EmptyState 
        message="Sorry, I couldn't find any QoS details."
        icon={<AlertCircle className="w-8 h-8 mx-auto" />}
      />
    );
  }

  const isUnlimited = (val: string | number) => val === '∞';

  return (
    <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span className="text-muted-foreground">QoS</span>
              <span className="text-primary font-mono">{qosData.name}</span>
              <CopyButton text={qosData.name} />
            </CardTitle>
            {qosData.description && (
              <div className="text-xs text-muted-foreground">{qosData.description}</div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Priority</div>
          <div className="text-xl font-bold text-primary">
            {isUnlimited(qosData.priority) ? <Infinity className="w-5 h-5 inline" /> : qosData.priority}
          </div>
        </div>
      </div>

      <Separator />

      <CardContent className="p-4 space-y-3">
        {/* Limits Row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Max Jobs/User</div>
            <div className="font-semibold">
              {isUnlimited(qosData.maxJobsPerUser) ? <Infinity className="w-4 h-4 inline" /> : qosData.maxJobsPerUser}
            </div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Max Submit/User</div>
            <div className="font-semibold">
              {isUnlimited(qosData.maxSubmitPerUser) ? <Infinity className="w-4 h-4 inline" /> : qosData.maxSubmitPerUser}
            </div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Max Wall Time</div>
            <div className="font-semibold">
              {isUnlimited(qosData.maxWallPerJob) ? <Infinity className="w-4 h-4 inline" /> : 
                typeof qosData.maxWallPerJob === 'number' ? formatDuration(qosData.maxWallPerJob) : qosData.maxWallPerJob}
            </div>
          </div>
        </div>

        {/* Usage Factor + Preempt Row */}
        <div className="flex items-center gap-4 text-xs py-2 px-3 bg-muted/30 rounded-lg">
          <span>
            <span className="text-muted-foreground">Usage Factor:</span>{' '}
            <span className="font-medium">{isUnlimited(qosData.usageFactor) ? '∞' : qosData.usageFactor}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Preempt:</span>{' '}
            {qosData.preemptMode.length > 0 ? (
              qosData.preemptMode.map((mode: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs py-0 h-5 ml-1">
                  {mode}
                </Badge>
              ))
            ) : (
              <span className="font-medium">None</span>
            )}
          </span>
        </div>

        {/* Flags - only if present */}
        {qosData.flags.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Flags:</span>
            {qosData.flags.map((flag: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs py-0 h-5">
                {flag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const SlurmQosDetails = memo(SlurmQosDetailsComponent);
export default SlurmQosDetails;
