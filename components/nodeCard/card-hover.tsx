import React from "react";
import GPUUsageDisplay from "./gpu-progress";
import { ServerIcon, CpuIcon, LayersIcon, OctagonIcon } from "lucide-react";

interface GPUResources {
  slices: {
    total: { [key: string]: number };
    used: { [key: string]: number };
  };
  sliceType: "SHARD" | "MIG" | "NOSLICE";
}

const parseGPUResources = (gres: string, gresUsed: string): GPUResources => {
  const resources: GPUResources = {
    slices: { total: {}, used: {} },
    sliceType: "NOSLICE",
  };

  if (gres.includes("g.20gb")) {
    resources.sliceType = "MIG";
    const migTypes = ["2g.20gb", "1g.20gb"];

    migTypes.forEach((type) => {
      const totalMatch = gres.match(new RegExp(`gpu:${type}:(\\d+)`));
      if (totalMatch) {
        resources.slices.total[type] = parseInt(totalMatch[1]);
      }

      const usedMatch = gresUsed.match(new RegExp(`gpu:${type}:(\\d+)`));
      if (usedMatch) {
        resources.slices.used[type] = parseInt(usedMatch[1]);
      } else {
        resources.slices.used[type] = 0;
      }
    });
  } else if (gres.includes("shard")) {
    resources.sliceType = "SHARD";
    const gresGPUMatch = gres.match(/gpu:(\d+)/i);
    const gresShardMatch = gres.match(/shard:(\d+)/i);
    if (gresGPUMatch) resources.slices.total["GPU"] = parseInt(gresGPUMatch[1]);
    if (gresShardMatch)
      resources.slices.total["SHARD"] = parseInt(gresShardMatch[1]);

    const gresUsedGPUMatch = gresUsed.match(/gpu:\(null\):(\d+)/i);
    const gresUsedShardMatch = gresUsed.match(/shard:\(null\):(\d+)/i);
    if (gresUsedGPUMatch)
      resources.slices.used["GPU"] = parseInt(gresUsedGPUMatch[1]);
    if (gresUsedShardMatch) {
      resources.slices.used["SHARD"] = parseInt(gresUsedShardMatch[1]);
    } else {
      resources.slices.used["SHARD"] = 0;
    }

    // Ensure both GPU and SHARD have values
    resources.slices.total["GPU"] = resources.slices.total["GPU"] || 0;
    resources.slices.total["SHARD"] = resources.slices.total["SHARD"] || 0;
    resources.slices.used["GPU"] = resources.slices.used["GPU"] || 0;
    resources.slices.used["SHARD"] = resources.slices.used["SHARD"] || 0;
  } else {
    // No Slice GPU case
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

interface CardHoverProps {
  nodeData: {
    hostname: string;
    features: string[];
    partitions: string[];
    gres: string;
    gres_used: string;
    reason?: string;
  };
  cpuLoad: number;
  statusDef: string;
}

const CardHover: React.FC<CardHoverProps> = ({
  nodeData,
  cpuLoad,
  statusDef,
}) => {
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

      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-sm font-medium">
          <LayersIcon className="h-4 w-4" />
          <span>Features:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {nodeData.features.map((feature: string, index: number) => (
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
          {nodeData.partitions.map((partition: string, index: number) => (
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
          {gpuResources.sliceType === "MIG" &&
            Object.entries(gpuResources.slices.total).map(
              ([sliceType, total]) => (
                <div key={sliceType} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span>{`MIG ${sliceType}`}</span>
                    <span>{`${gpuResources.slices.used[sliceType]} / ${total} used`}</span>
                  </div>
                  <GPUUsageDisplay
                    gpuUsed={gpuResources.slices.used[sliceType]}
                    gpuTotal={total}
                  />
                  <div className="text-xs text-gray-200">
                    {`${(
                      (gpuResources.slices.used[sliceType] / total) *
                      100
                    ).toFixed(1)}% utilization`}
                  </div>
                </div>
              )
            )}
          {gpuResources.sliceType === "SHARD" && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span>Physical GPUs</span>
                  <span>{`${gpuResources.slices.used["GPU"]} / ${gpuResources.slices.total["GPU"]} used`}</span>
                </div>
                <GPUUsageDisplay
                  gpuUsed={gpuResources.slices.used["GPU"]}
                  gpuTotal={gpuResources.slices.total["GPU"]}
                />
                <div className="text-xs text-gray-200">
                  {`${(
                    (gpuResources.slices.used["GPU"] /
                      gpuResources.slices.total["GPU"]) *
                    100
                  ).toFixed(1)}% utilization`}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span>GPU Shards</span>
                  <span>{`${gpuResources.slices.used["SHARD"]} / ${gpuResources.slices.total["SHARD"]} used`}</span>
                </div>
                <GPUUsageDisplay
                  gpuUsed={gpuResources.slices.used["SHARD"]}
                  gpuTotal={gpuResources.slices.total["SHARD"]}
                />
                <div className="text-xs text-gray-200">
                  {`${(
                    (gpuResources.slices.used["SHARD"] /
                      gpuResources.slices.total["SHARD"]) *
                    100
                  ).toFixed(1)}% utilization`}
                </div>
              </div>
            </>
          )}
          {gpuResources.sliceType === "NOSLICE" &&
            Object.entries(gpuResources.slices.total).map(
              ([gpuType, total]) => (
                <div key={gpuType} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span>{gpuType.toUpperCase()}</span>
                    <span>{`${gpuResources.slices.used[gpuType]} / ${total} used`}</span>
                  </div>
                  <GPUUsageDisplay
                    gpuUsed={gpuResources.slices.used[gpuType]}
                    gpuTotal={total}
                  />
                  <div className="text-xs text-gray-200">
                    {`${(
                      (gpuResources.slices.used[gpuType] / total) *
                      100
                    ).toFixed(1)}% utilization`}
                  </div>
                </div>
              )
            )}
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
