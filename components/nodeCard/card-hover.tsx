import React from "react";
import {
  ServerIcon,
  CpuIcon,
  LayersIcon,
  OctagonIcon,
  BoltIcon,
} from "lucide-react";
import GPUUsageDisplay from "./gpu-progress";
import { CardHoverProps, GPUResources } from "@/types/types";

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

const GPUResourcesDisplay: React.FC<{ gpuResources: GPUResources }> = ({
  gpuResources,
}) => {
  const renderGPUUsage = (sliceType: string, total: number, used: number) => (
    <div key={sliceType} className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span>{sliceType}</span>
        <span>{`${used} / ${total} used`}</span>
      </div>
      <GPUUsageDisplay gpuUsed={used} gpuTotal={total} />
      <div className="text-xs text-gray-200">
        {`${((used / total) * 100).toFixed(1)}% utilization`}
      </div>
    </div>
  );

  switch (gpuResources.sliceType) {
    case "MIG":
      return (
        <>
          {Object.entries(gpuResources.slices.total).map(([sliceType, total]) =>
            renderGPUUsage(
              `MIG ${sliceType}`,
              total,
              gpuResources.slices.used[sliceType]
            )
          )}
        </>
      );
    case "SHARD":
      return (
        <>
          {renderGPUUsage(
            "Physical GPUs",
            gpuResources.slices.total["GPU"],
            gpuResources.slices.used["GPU"]
          )}
          {renderGPUUsage(
            "GPU Shards",
            gpuResources.slices.total["SHARD"],
            gpuResources.slices.used["SHARD"]
          )}
        </>
      );
    default:
      return (
        <>
          {Object.entries(gpuResources.slices.total).map(([gpuType, total]) =>
            renderGPUUsage(
              gpuType.toUpperCase(),
              total,
              gpuResources.slices.used[gpuType]
            )
          )}
        </>
      );
  }
};

const CardHover = ({ nodeData, cpuLoad, statusDef }: CardHoverProps) => {
  const gpuResources = parseGPUResources(nodeData.gres, nodeData.gres_used);

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center space-x-2 text-lg font-semibold">
        <ServerIcon className="h-5 w-5" />
        <span>{nodeData.hostname}</span>
      </div>

      <div className="flex items-center space-x-2 text-sm">
        <CpuIcon className="h-4 w-4" />
        <span>CPU Load: {cpuLoad.toFixed(2)}%</span>
      </div>

      {nodeData.energy && nodeData.energy.current_watts.number > 0 && (
        <div className="space-y-2 border p-2 rounded-lg bg-gray-800/50">
          <div className="flex items-center space-x-2 text-sm font-medium border-b border-gray-700 pb-2">
            <BoltIcon className="h-4 w-4 text-yellow-500" />
            <span>Power Usage</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {nodeData.energy.current_watts?.set && (
              <div className="text-sm">
                <span className="text-gray-400">Current:</span>
                <span className="ml-2 font-medium text-white">
                  {nodeData.energy.current_watts.number}W
                </span>
              </div>
            )}
            {nodeData.energy.average_watts > 0 && (
              <div className="text-sm">
                <span className="text-gray-400">Average:</span>
                <span className="ml-2 font-medium text-white">
                  {nodeData.energy.average_watts}W
                </span>
              </div>
            )}
          </div>
          <div className="text-sm pt-1">
            <span className="text-gray-400">Total Energy:</span>
            <span className="ml-2 font-medium text-white">
              {(nodeData.energy.consumed_energy / 3600000).toFixed(2)} kWh
            </span>
          </div>
          {nodeData.energy.last_collected && (
            <div className="text-xs text-gray-400 pt-1">
              Last updated:{" "}
              {new Date(nodeData.energy.last_collected * 1000).toLocaleString()}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm font-medium">
          <LayersIcon className="h-4 w-4" />
          <span>Features:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {nodeData.features.map((feature, index) => (
            <div
              key={index}
              className="px-2 py-1 bg-gray-800 rounded-full text-xs"
            >
              {feature}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm font-medium">
          <OctagonIcon className="h-4 w-4" />
          <span>Partitions:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {nodeData.partitions.map((partition, index) => (
            <div
              key={index}
              className="px-2 py-1 bg-blue-900 rounded-full text-xs"
            >
              {partition}
            </div>
          ))}
        </div>
      </div>

      {nodeData.gres && (
        <div className="space-y-2 border-t pt-2 border-gray-700">
          <div className="text-sm font-medium">GPU Resources:</div>
          <div className="text-xs text-gray-400">
            <div>GRES: {nodeData.gres}</div>
            <div>GRES Used: {nodeData.gres_used}</div>
          </div>
          <GPUResourcesDisplay gpuResources={gpuResources} />
        </div>
      )}

      <div className="border-t pt-2 border-gray-700">
        <div className="text-sm font-medium">Node Status:</div>
        <div className="mt-1 px-2 py-1 bg-gray-800 rounded text-xs">
          {statusDef}
        </div>
        {nodeData.reason && (
          <div className="mt-2">
            <div className="text-sm font-medium">Reason:</div>
            <div className="mt-1 px-2 py-1 bg-yellow-900 rounded text-xs">
              {nodeData.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardHover;
