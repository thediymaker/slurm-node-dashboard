interface GPUResource {
  type: string;
  total: number;
  used: number;
}

export const parseGPUResources = (
  gres: string | null,
  gresUsed: string
): {
  resources: GPUResource[];
  gpuUsed: number;
  gpuTotal: number;
  isMIG: boolean;
} => {
  const resources: GPUResource[] = [];
  let isMIG = false;

  const parseResourceString = (str: string, isUsed: boolean) => {
    const parts = str.split(":");
    if (parts.length < 2) return null;

    const resourceType = parts[0];
    const details = parts.slice(1).join(":");

    if (resourceType === "gpu" && details.includes("g.")) {
      isMIG = true;
      const [type, countOrUsed] = details.split(":");
      const value = parseInt(isUsed ? countOrUsed.split("(")[0] : countOrUsed);
      return { type, value, resourceType };
    } else if (resourceType === "gpu" && details.includes("mi25")) {
      const value = parseInt(isUsed ? parts[2].split("(")[0] : parts[2]);
      return { type: resourceType, value, resourceType };
    } else if (resourceType === "gpu" || resourceType === "shard") {
      let value;
      if (isUsed) {
        const match = details.match(/(\d+)/);
        value = match ? parseInt(match[1]) : 0;
      } else {
        value = parseInt(details);
      }
      return { type: resourceType, value, resourceType };
    }
    return null;
  };

  const parseAndAddResource = (match: string, isUsed: boolean) => {
    const parsed = parseResourceString(match, isUsed);
    if (parsed) {
      const existingResource = resources.find((r) => r.type === parsed.type);
      if (existingResource) {
        if (isUsed) {
          existingResource.used += parsed.value;
        } else {
          existingResource.total += parsed.value;
        }
      } else {
        resources.push({
          type: parsed.type,
          total: isUsed ? 0 : parsed.value,
          used: isUsed ? parsed.value : 0,
        });
      }
    }
  };

  (gres?.match(/(?:gpu|shard):[^,]+/g) || []).forEach((match) =>
    parseAndAddResource(match, false)
  );
  (gresUsed?.match(/(?:gpu|shard):[^,]+/g) || []).forEach((match) =>
    parseAndAddResource(match, true)
  );

  let gpuTotal = 0;
  let gpuUsed = 0;

  if (isMIG) {
    const migResources = resources.filter((r) => r.type.includes("g."));
    migResources.forEach((resource) => {
      gpuTotal += resource.total;
      gpuUsed += resource.used;
    });
  } else {
    const gpuResource = resources.find((r) => r.type === "gpu");
    const shardResource = resources.find((r) => r.type === "shard");

    if (gpuResource && shardResource) {
      gpuTotal = gpuResource.total;
      const shardsPerGPU = shardResource.total / gpuResource.total || 1;
      const fullGPUsUsed = Math.floor(gpuResource.used);
      const additionalShardsUsed = shardResource.used % shardsPerGPU;
      gpuUsed = fullGPUsUsed + additionalShardsUsed / shardsPerGPU;
    } else if (shardResource) {
      gpuTotal = shardResource.total / 4; // Assuming 4 shards per GPU
      gpuUsed = shardResource.used / 4;
    } else if (gpuResource) {
      gpuTotal = gpuResource.total;
      gpuUsed = gpuResource.used;
    }
  }

  return { resources, gpuUsed, gpuTotal, isMIG };
};
