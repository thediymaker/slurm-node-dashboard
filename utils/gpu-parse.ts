"use client";

import { GPUResource } from "@/types/types";

export const parseGPUResources = (
  gres: string | null,
  gresUsed: string
): any => {
  const resources: GPUResource[] = [];
  let isMIG = false;

  const addResource = (
    type: string,
    gpuTotal: number,
    gpuUsed: number,
    shardTotal: number = 0,
    shardUsed: number = 0
  ) => {
    const resource = resources.find((r) => r.type === type);
    if (resource) {
      // If this resource already exists, only add the new totals
      resource.total += gpuTotal;
      resource.used += gpuUsed;
      resource.shardsTotal = Math.max(resource.shardsTotal, shardTotal);
      resource.shardsUsed += shardUsed;
    } else {
      // If this is a new resource, add it
      resources.push({
        type,
        total: gpuTotal,
        used: gpuUsed,
        shardsTotal: shardTotal,
        shardsUsed: shardUsed,
      });
    }
  };

  const parseGRES = (gresString: string | null, isUsed: boolean) => {
    if (!gresString) return;

    const regex = /(gpu|shard):([\w.]+|\(null\)):(\d+)(?:\((.*?)\))?/g;
    let match;
    while ((match = regex.exec(gresString)) !== null) {
      const [, type, gpuType, valueStr, shardDetails] = match;
      const value = parseInt(valueStr, 10);

      if (type === "gpu" && gpuType.includes("g.")) {
        isMIG = true;
      }

      const resourceType = gpuType === "(null)" ? type.toUpperCase() : gpuType;

      if (type === "shard") {
        const shardTotal = value;
        const shardUsed = isUsed ? shardTotal : 0;
        addResource(resourceType, 0, 0, shardTotal, shardUsed);
      } else {
        addResource(resourceType, isUsed ? 0 : value, isUsed ? value : 0);
      }
    }
  };

  parseGRES(gres, false);
  parseGRES(gresUsed, true);

  let gpuTotal = 0;
  let gpuUsed = 0;
  let gpuUtilizationPercentage = 0;

  resources.forEach((resource) => {
    gpuTotal += resource.total;

    // Only perform shard calculations if shards exist
    if (resource.shardsTotal > 0) {
      const shardsPerGPU =
        resource.total > 0 ? resource.shardsTotal / resource.total : 0;

      // Calculate remaining shards after full GPU usage
      const remainingShardsTotal =
        resource.shardsTotal - resource.used * shardsPerGPU;
      const remainingShardsUsed = Math.min(
        resource.shardsUsed,
        remainingShardsTotal
      );

      const adjustedGpuUsed =
        resource.used +
        (shardsPerGPU > 0 ? remainingShardsUsed / shardsPerGPU : 0);
      gpuUsed += adjustedGpuUsed;

      gpuUtilizationPercentage += (adjustedGpuUsed / resource.total) * 100;
    } else {
      // Handle non-shard cases
      gpuUsed += resource.used;
      gpuUtilizationPercentage += (resource.used / resource.total) * 100;
    }
  });

  return { resources, gpuUsed, gpuTotal, isMIG };
};
