"use client";
import React, { memo, useMemo, useCallback } from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Server,
  AlertCircle,
} from "lucide-react";
import {
  StateBadge,
  CopyButton,
  EmptyState,
  formatRelativeTime,
  formatMemory,
} from "./llm-shared-utils";

interface NodeInfo {
  // Support both field name variations from the API
  name?: string;
  node_name?: string;
  hostname?: string;
  cpus: number;
  cpu_load: number | { number: number };
  // API may return state as string or array
  state: string | string[];
  state_flags?: string[];
  features?: string[];
  available_features?: string[];
  active_features?: string[];
  partitions: string[];
  real_memory: number;
  architecture?: string;
  boot_time?: string | number | { number: number };
  last_busy?: string | number | { number: number };
  gres?: string;
  gres_used?: string;
  operating_system?: string;
  alloc_cpus?: number;
  alloc_memory?: number;
  alloc_mem?: number;
  free_mem?: number | { number: number };
  address?: string;
  reason?: string;
  sockets?: number;
  cores?: number;
  threads?: number;
  tres?: string;
  tres_used?: string;
  reservation?: string;
  comment?: string;
  version?: string;
}

interface SlurmNodeDetailsProps {
  node: {
    nodes: NodeInfo[];
  };
}

// Helper to extract number from various formats
const extractNumber = (val: string | number | { number: number } | undefined): number | undefined => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'number' in val) return val.number;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const getLoadColor = (percentage: number) => {
  if (percentage < 50) return 'text-emerald-400';
  if (percentage < 80) return 'text-amber-400';
  return 'text-red-400';
};

function SlurmNodeDetailsComponent({ node }: SlurmNodeDetailsProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const nodeData = useMemo(() => {
    if (!node?.nodes?.length) return null;
    
    const raw = node.nodes[0];
    
    // Normalize field names - API may use different naming conventions
    const nodeName = raw.name || raw.node_name || raw.hostname || 'Unknown';
    
    // Normalize state - could be string or array
    let stateArray: string[] = [];
    if (Array.isArray(raw.state)) {
      stateArray = raw.state;
    } else if (typeof raw.state === 'string') {
      stateArray = [raw.state];
    }
    // Append state_flags if present
    if (raw.state_flags?.length) {
      stateArray = [...stateArray, ...raw.state_flags];
    }
    
    // Normalize CPU load - could be number or object
    // Slurm returns cpu_load scaled by 100 (e.g., 200 = 2.00 load)
    const rawCpuLoad = typeof raw.cpu_load === 'object' ? raw.cpu_load.number : (raw.cpu_load || 0);
    const cpuLoad = rawCpuLoad / 100;
    
    // Normalize features - might be in different fields
    const features = raw.features || raw.available_features || raw.active_features || [];
    
    // Normalize timestamps
    const bootTime = extractNumber(raw.boot_time);
    const lastBusy = extractNumber(raw.last_busy);
    
    // Normalize memory
    const allocMemory = raw.alloc_memory || raw.alloc_mem || 0;
    
    // Calculate percentages
    const cpuUsagePercentage = raw.cpus > 0 ? (cpuLoad / raw.cpus) * 100 : 0;
    const memoryPercentage = raw.real_memory > 0 ? (allocMemory / raw.real_memory) * 100 : 0;
    
    const primaryState = stateArray[0] || 'UNKNOWN';
    const isActive = primaryState === 'ALLOCATED' || primaryState === 'MIXED';
    
    // Extract free memory
    const freeMem = extractNumber(raw.free_mem) ?? 0;
    
    // Create normalized nodeInfo object
    const nodeInfo = {
      name: nodeName,
      cpus: raw.cpus || 0,
      cpu_load: cpuLoad,
      state: stateArray,
      features: Array.isArray(features) ? features : [],
      partitions: raw.partitions || [],
      real_memory: raw.real_memory || 0,
      architecture: raw.architecture || '',
      boot_time: bootTime,
      last_busy: lastBusy,
      gres: raw.gres || '',
      gres_used: raw.gres_used || '',
      operating_system: raw.operating_system || '',
      alloc_cpus: raw.alloc_cpus || 0,
      alloc_memory: allocMemory,
      // Additional useful fields
      hostname: raw.hostname || raw.address || nodeName,
      address: raw.address || raw.hostname || '',
      reason: raw.reason || '',
      sockets: raw.sockets || 0,
      cores: raw.cores || 0,
      threads: raw.threads || 0,
      free_mem: freeMem,
      tres: raw.tres || '',
      tres_used: raw.tres_used || '',
      reservation: raw.reservation || '',
      comment: raw.comment || '',
      version: raw.version || '',
    };
    
    return {
      nodeInfo,
      cpuUsagePercentage,
      memoryUsed: allocMemory,
      memoryPercentage,
      primaryState,
      isActive,
      allocatedCpus: raw.alloc_cpus || 0,
    };
  }, [node]);

  if (!nodeData) {
    return (
      <EmptyState 
        message="Sorry, I couldn't find any node details for the node you provided. Please try again with a valid node name."
        icon={<AlertCircle className="w-8 h-8 mx-auto" />}
      />
    );
  }

  const { nodeInfo, cpuUsagePercentage, primaryState, isActive, allocatedCpus } = nodeData;

  return (
    <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span className="text-muted-foreground">Node</span>
              <span className="text-primary font-mono">{nodeInfo.name}</span>
              <CopyButton text={nodeInfo.name} />
            </CardTitle>
            {(nodeInfo.architecture || nodeInfo.operating_system) && (
              <div className="text-xs text-muted-foreground">
                {nodeInfo.architecture}{nodeInfo.architecture && nodeInfo.operating_system && ' • '}
                <span className="truncate max-w-[200px] inline-block align-bottom">{nodeInfo.operating_system}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nodeInfo.state?.map((state, index) => (
            <StateBadge key={index} state={state} type="node" />
          ))}
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
        {/* Load Bar + Stats Row */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Load</span>
              <span className={`text-xs font-medium ${getLoadColor(cpuUsagePercentage)}`}>
                {cpuUsagePercentage.toFixed(0)}%
              </span>
            </div>
            <Progress value={Math.min(cpuUsagePercentage, 100)} className="h-1.5" />
          </div>
          <div className="text-center px-3 border-l">
            <div className="text-xs text-muted-foreground">CPUs</div>
            <div className="font-semibold text-primary">{allocatedCpus > 0 ? `${allocatedCpus}/${nodeInfo.cpus}` : nodeInfo.cpus}</div>
          </div>
          <div className="text-center px-3 border-l">
            <div className="text-xs text-muted-foreground">Memory</div>
            <div className="font-semibold">{formatMemory(nodeInfo.real_memory)}</div>
          </div>
        </div>

        {/* GRES - separate row for full display */}
        {nodeInfo.gres_used && (
          <div className="flex items-center gap-2 text-xs py-2 px-3 bg-muted/30 rounded-lg">
            <span className="text-muted-foreground">GRES:</span>
            <span className="font-mono">{nodeInfo.gres_used}</span>
          </div>
        )}

        {/* CPU Topology - inline */}
        {(nodeInfo.sockets > 0 || nodeInfo.cores > 0 || nodeInfo.threads > 0) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 px-3 bg-muted/30 rounded-lg">
            <span className="font-medium text-foreground">Topology:</span>
            {nodeInfo.sockets > 0 && <span>{nodeInfo.sockets} socket{nodeInfo.sockets > 1 ? 's' : ''}</span>}
            {nodeInfo.cores > 0 && <span>× {nodeInfo.cores} cores</span>}
            {nodeInfo.threads > 0 && <span>× {nodeInfo.threads} threads</span>}
          </div>
        )}

        {/* Reason - only when present */}
        {nodeInfo.reason && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-amber-400 font-medium">Reason:</span>
            <span className="text-muted-foreground">{nodeInfo.reason}</span>
          </div>
        )}

        {/* Features + Partitions Row */}
        <div className="flex flex-wrap gap-3">
          {nodeInfo.features?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Features:</span>
              {nodeInfo.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs py-0 h-5">
                  {feature}
                </Badge>
              ))}
            </div>
          )}
          {nodeInfo.partitions?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Partitions:</span>
              {nodeInfo.partitions.map((partition, index) => (
                <Badge key={index} variant="secondary" className="text-xs py-0 h-5 bg-primary/10 text-primary">
                  {partition}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Timestamps - compact inline */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          {nodeInfo.boot_time && (
            <span>Boot: {formatRelativeTime(nodeInfo.boot_time)}</span>
          )}
          {nodeInfo.last_busy && (
            <span>Last busy: {formatRelativeTime(nodeInfo.last_busy)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const SlurmNodeDetails = memo(SlurmNodeDetailsComponent);
export default SlurmNodeDetails;
