"use client";
import React, { memo, useMemo } from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  CopyButton,
  EmptyState,
  formatDuration,
  formatMemory,
} from "./llm-shared-utils";

interface SlurmPartitionDetailsProps {
  partition: {
    partitions: any[];
  };
}

const getStateColor = (state: string) => {
  if (state === 'UP') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (state === 'DOWN') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (state === 'DRAIN') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
};

function SlurmPartitionDetailsComponent({ partition }: SlurmPartitionDetailsProps) {
  const partitionData = useMemo(() => {
    if (!partition?.partitions?.length) return null;
    
    const p = partition.partitions[0];
    
    // Get state
    let state = 'Unknown';
    if (p.partition?.state?.length) state = p.partition.state[0];
    else if (typeof p.state === 'string') state = p.state;

    // Get total nodes
    let totalNodes = 0;
    if (typeof p.nodes === 'object' && p.nodes !== null) {
      totalNodes = p.nodes.total || 0;
    } else if (p.total_nodes) {
      totalNodes = typeof p.total_nodes === 'number' ? p.total_nodes : p.total_nodes.total || 0;
    }

    // Get node list
    let nodeList = '';
    if (typeof p.nodes === 'object' && p.nodes !== null) {
      nodeList = p.nodes.configured || '';
    } else if (typeof p.nodes === 'string') {
      nodeList = p.nodes;
    }

    // Get total CPUs
    let totalCPUs = 0;
    if (p.cpus?.total) totalCPUs = p.cpus.total;
    else if (p.total_cpus) {
      totalCPUs = typeof p.total_cpus === 'number' ? p.total_cpus : p.total_cpus.total || 0;
    }

    // Get max time
    let maxTime: string | number = '∞';
    if (p.maximums?.time) {
      maxTime = p.maximums.time.infinite ? '∞' : p.maximums.time.number;
    } else if (p.max_time) {
      maxTime = typeof p.max_time === 'string' ? p.max_time : p.max_time.number;
    }

    // Get memory config
    let memoryConfig = '';
    if (p.defaults?.partition_memory_per_cpu?.number) {
      memoryConfig = `${formatMemory(p.defaults.partition_memory_per_cpu.number)}/CPU`;
    } else if (p.defaults?.partition_memory_per_node?.number) {
      memoryConfig = `${formatMemory(p.defaults.partition_memory_per_node.number)}/Node`;
    } else if (p.default_memory_per_cpu?.number) {
      memoryConfig = `${formatMemory(p.default_memory_per_cpu.number)}/CPU`;
    } else if (p.def_mem_per_cpu?.number) {
      memoryConfig = `${formatMemory(p.def_mem_per_cpu.number)}/CPU`;
    }

    return {
      name: p.name,
      state,
      totalNodes,
      nodeList,
      totalCPUs,
      maxTime,
      memoryConfig,
      qos: p.qos_char || '',
      isUp: state === 'UP',
    };
  }, [partition]);

  if (!partitionData) {
    return (
      <EmptyState 
        message="Sorry, I couldn't find any partition details."
        icon={<AlertCircle className="w-8 h-8 mx-auto" />}
      />
    );
  }

  const { name, state, totalNodes, nodeList, totalCPUs, maxTime, memoryConfig, qos, isUp } = partitionData;

  return (
    <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isUp ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            {isUp ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span className="text-muted-foreground">Partition</span>
              <span className="text-primary font-mono">{name}</span>
              <CopyButton text={name} />
            </CardTitle>
            {qos && <div className="text-xs text-muted-foreground">QoS: {qos}</div>}
          </div>
        </div>
        <Badge variant="secondary" className={getStateColor(state)}>
          {state}
        </Badge>
      </div>

      <Separator />

      <CardContent className="p-4 space-y-3">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Nodes</div>
            <div className="font-semibold text-primary">{totalNodes}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">CPUs</div>
            <div className="font-semibold">{totalCPUs.toLocaleString()}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Max Time</div>
            <div className="font-medium text-sm">
              {typeof maxTime === 'number' ? formatDuration(maxTime) : maxTime}
            </div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Memory</div>
            <div className="font-medium text-sm">{memoryConfig || 'Default'}</div>
          </div>
        </div>

        {/* Node List - only if present */}
        {nodeList && (
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Nodes</span>
              <CopyButton text={nodeList} />
            </div>
            <code className="text-xs font-mono text-muted-foreground break-all block">
              {nodeList.length > 100 ? `${nodeList.slice(0, 100)}...` : nodeList}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const SlurmPartitionDetails = memo(SlurmPartitionDetailsComponent);
export default SlurmPartitionDetails;
