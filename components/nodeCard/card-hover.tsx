import GPUUsageDisplay from "./gpu-progress";
import { ServerIcon, CpuIcon, LayersIcon, OctagonIcon } from "lucide-react";

const parseGPUResources = (gres: string, gresUsed: string) => {
  const resources: { [key: string]: { total: number; used: number } } = {};

  // Parse GRES
  const gresMatches = gres.match(/gpu:[\w.]+:(\d+)/g);
  if (gresMatches) {
    gresMatches.forEach((match) => {
      const [, type, total] = match.split(":");
      resources[type] = { total: parseInt(total), used: 0 };
    });
  }

  // Parse GRES Used
  const gresUsedMatches = gresUsed.match(/gpu:[\w.]+:(\d+)/g);
  if (gresUsedMatches) {
    gresUsedMatches.forEach((match) => {
      const [, type, used] = match.split(":");
      if (resources[type]) {
        resources[type].used = parseInt(used);
      }
    });
  }

  // Parse Shards
  const shardMatch = gres.match(/shard:(\d+)/);
  const shardUsedMatch = gresUsed.match(/shard:\(null\):(\d+)/);
  if (shardMatch && shardUsedMatch) {
    resources["shard"] = {
      total: parseInt(shardMatch[1]),
      used: parseInt(shardUsedMatch[1]),
    };
  }

  return resources;
};

export default function CardHover({ nodeData, cpuLoad, statusDef }: any) {
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
              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs"
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
              className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded-full text-xs"
            >
              {partition}
            </div>
          ))}
        </div>
      </div>

      {nodeData.gres && (
        <div className="space-y-2 border-t pt-2 dark:border-gray-700">
          <div className="text-sm font-medium">GPU Resources:</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div>GRES: {nodeData.gres}</div>
            <div>GRES Used: {nodeData.gres_used}</div>
          </div>
          {Object.entries(gpuResources).map(([type, { total, used }]) => (
            <div key={type} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span>{type === "shard" ? "GPU Shard" : `GPU ${type}`}</span>
                <span>{`${used} / ${total} ${
                  type === "shard" ? "slices" : ""
                } used`}</span>
              </div>
              <GPUUsageDisplay gpuUsed={used} gpuTotal={total} />
              <div className="text-xs text-gray-500">{`${(
                (used / total) *
                100
              ).toFixed(1)}% utilization`}</div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-2 dark:border-gray-700">
        <div className="text-sm font-medium">Node Status:</div>
        <div className="mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
          {statusDef}
        </div>
        {nodeData.reason && (
          <div className="mt-2">
            <div className="text-sm font-medium">Reason:</div>
            <div className="mt-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 rounded text-xs">
              {nodeData.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
