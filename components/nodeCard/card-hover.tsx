import { memo, useMemo } from "react";
import { CardHoverProps, GPUResources } from "@/types/types";
import { cn } from "@/lib/utils";
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

interface HoverProps {
  nodeData: CardHoverProps["nodeData"];
  cpuLoad: number;
  // State label and the card's background class, for the dot
  stateLabel: string;
  stateClass: string;
}

const CardHover = memo(({ nodeData, cpuLoad, stateLabel, stateClass }: HoverProps) => {
  const gpuResources = useMemo(
    () => parseGPUResources(nodeData.gres, nodeData.gres_used),
    [nodeData.gres, nodeData.gres_used]
  );
  const memUsedGB = (nodeData.alloc_memory / 1024).toFixed(1);
  const memTotalGB = (nodeData.real_memory / 1024).toFixed(1);
  const watts = nodeData.energy?.current_watts?.number ?? 0;
  const chips = [...(nodeData.partitions ?? []), ...(nodeData.features ?? [])];

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{nodeData.hostname}</span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", stateClass)} />
          {stateLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
        <span>
          <span className="text-muted-foreground">CPU </span>
          {nodeData.alloc_cpus}/{nodeData.cpus}
        </span>
        <span>
          <span className="text-muted-foreground">Mem </span>
          {memUsedGB}/{memTotalGB} GB
        </span>
        <span>
          <span className="text-muted-foreground">Load </span>
          {Math.round(cpuLoad * 100)}%
        </span>
        {watts > 0 && (
          <span>
            <span className="text-muted-foreground">Power </span>
            {watts} W
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip, i) => (
            <span key={`${chip}-${i}`} className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {chip}
            </span>
          ))}
        </div>
      )}

      {nodeData.gres && (
        <div className="border-t pt-2">
          <GPUResourcesDisplay gpuResources={gpuResources} hostname={nodeData.hostname} nodeData={nodeData} />
        </div>
      )}

      {nodeData.reason && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-yellow-800 dark:text-yellow-200">
          {nodeData.reason}
        </div>
      )}
    </div>
  );
});
CardHover.displayName = "CardHover";

export default CardHover;
