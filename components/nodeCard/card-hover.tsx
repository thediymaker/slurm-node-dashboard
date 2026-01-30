import React from "react";
import {
  ServerIcon,
  CpuIcon,
  MemoryStick,
  Activity,
  LayersIcon,
  OctagonIcon,
  BoltIcon,
  AlertCircle,
} from "lucide-react";
import { CardHoverProps, GPUResources } from "@/types/types";
import GPUResourcesDisplay from "./gpu-resource";

const parseGPUResources = (gres: string, gresUsed: string): GPUResources => {
  const resources: GPUResources = {
    slices: { total: {}, used: {} },
    sliceType: "NOSLICE",
  };

  if (gres.includes("shard")) {
    resources.sliceType = "SHARD";
    const [gpuTotal, shardTotal] = [
      gres.match(/gpu:(\w+):(\d+)/i),
      gres.match(/shard:(\w+):(\d+)/i),
    ];
    const [gpuUsed, shardUsed] = [
      gresUsed.match(/gpu:\w+:(\d+)/i),
      gresUsed.match(/shard:\w+:(\d+)/i),
    ];

    resources.slices.total = {
      GPU: gpuTotal ? parseInt(gpuTotal[2]) : 0,
      SHARD: shardTotal ? parseInt(shardTotal[2]) : 0,
    };
    resources.slices.used = {
      GPU: gpuUsed ? parseInt(gpuUsed[1]) : 0,
      SHARD: shardUsed
        ? shardUsed[1]
            .split(/[(,)]/)
            .filter(Boolean)
            .reduce((acc, usage) => acc + parseInt(usage.split("/")[0]), 0)
        : 0,
    };
  } else if (gres.match(/gpu:\w+\.\w+:\d+/)) {
    resources.sliceType = "MIG";
    const sliceMatches = gres.match(/gpu:(\w+\.\w+):(\d+)/g) || [];
    sliceMatches.forEach((match) => {
      const [_, sliceType, count] = match.split(/[:]/);
      resources.slices.total[sliceType] = parseInt(count);
      const usedMatch = gresUsed.match(new RegExp(`gpu:${sliceType}:(\\d+)`));
      resources.slices.used[sliceType] = usedMatch ? parseInt(usedMatch[1]) : 0;
    });
  } else {
    const gpuMatch = gres.match(/gpu:(\w+):(\d+)/);
    if (gpuMatch) {
      const gpuType = gpuMatch[1];
      resources.slices.total[gpuType] = parseInt(gpuMatch[2]);
      const usedMatch = gresUsed.match(new RegExp(`gpu:${gpuType}:(\\d+)`));
      resources.slices.used[gpuType] = usedMatch ? parseInt(usedMatch[1]) : 0;
    }
  }

  return resources;
};

const CardHover = ({ nodeData, cpuLoad, statusDef }: CardHoverProps) => {
  const gpuResources = parseGPUResources(nodeData.gres, nodeData.gres_used);
  const memUsedGB = (nodeData.alloc_memory / 1024).toFixed(1);
  const memTotalGB = (nodeData.real_memory / 1024).toFixed(1);
  const memPercent = Math.round((nodeData.alloc_memory / nodeData.real_memory) * 100);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <ServerIcon className="h-4 w-4" />
        <span className="text-base font-bold">{nodeData.hostname}</span>
      </div>

      {/* Resource Stats - Inline */}
      <div className="flex gap-3 text-xs">
        <div>
          <span className="text-white/50">CPU </span>
          <span className="font-medium">{nodeData.alloc_cpus}/{nodeData.cpus}</span>
        </div>
        <div>
          <span className="text-white/50">Mem </span>
          <span className="font-medium">{memUsedGB}/{memTotalGB}G</span>
        </div>
        <div>
          <span className="text-white/50">Load </span>
          <span className="font-medium">{Math.round(cpuLoad * 100)}%</span>
        </div>
      </div>

      {/* Power Usage */}
      {nodeData.energy && nodeData.energy.current_watts.number > 0 && (
        <div className="text-xs flex gap-3">
          <div>
            <span className="text-white/50">Power </span>
            <span className="font-medium">{nodeData.energy.current_watts.number}W</span>
          </div>
          {nodeData.energy.average_watts > 0 && (
            <div>
              <span className="text-white/50">Avg </span>
              <span className="font-medium">{nodeData.energy.average_watts}W</span>
            </div>
          )}
        </div>
      )}

      {/* Features & Partitions - Combined row */}
      <div className="flex flex-wrap gap-1">
        {nodeData.features?.map((feature, index) => (
          <span key={`f-${index}`} className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px]">
            {feature}
          </span>
        ))}
        {nodeData.partitions?.map((partition, index) => (
          <span key={`p-${index}`} className="px-1.5 py-0.5 bg-blue-900/50 rounded text-[10px]">
            {partition}
          </span>
        ))}
      </div>

      {/* GPU Resources */}
      {nodeData.gres && (
        <div className="border-t border-white/10 pt-2">
          <div className="text-[10px] text-white/50 font-mono mb-1">
            <div>GRES: {nodeData.gres}</div>
            <div>GRES Used: {nodeData.gres_used}</div>
          </div>
          <GPUResourcesDisplay
            gpuResources={gpuResources}
            hostname={nodeData.hostname}
            nodeData={nodeData}
          />
        </div>
      )}

      {/* Status */}
      <div className="border-t border-white/10 pt-2">
        <div className="px-2 py-1.5 bg-zinc-800 rounded text-xs">
          {statusDef}
        </div>
        {nodeData.reason && (
          <div className="mt-1 px-2 py-1 bg-yellow-900/50 rounded text-[10px] text-yellow-200">
            {nodeData.reason}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardHover;