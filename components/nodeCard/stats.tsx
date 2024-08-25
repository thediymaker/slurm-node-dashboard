"use client";
import { RadialChart } from "../radialChart";
import React from "react";
import { parseGPUResources } from "@/utils/gpu-parse";
import { Node } from "@/types/types";

export default function Stats({ data }: { data: { nodes: Node[] } }) {
  const systems: Node[] = data?.nodes || [];

  const stats = React.useMemo(() => {
    let totalMemoryUsed = 0;
    let totalMemory = 0;
    let totalCoresUsed = 0;
    let totalCores = 0;
    let totalGpuUsed = 0;
    let totalGpu = 0;
    let totalNodes = 0;
    let totalGpuNodes = 0;
    let totalCpuNodes = 0;

    systems.forEach((node) => {
      totalMemoryUsed += node.alloc_memory;
      totalMemory += node.real_memory;
      totalCoresUsed += node.alloc_cpus;
      totalCores += node.cpus;
      if (node.gres) {
        const { gpuTotal, gpuUsed } = parseGPUResources(
          node.gres,
          node.gres_used
        );
        totalGpuUsed += gpuUsed;
        totalGpu += gpuTotal;
        totalGpuNodes++;
      } else {
        totalCpuNodes++;
      }
      totalNodes++;
    });

    return {
      totalMemoryUsed,
      totalMemory,
      totalCoresUsed,
      totalCores,
      totalGpuUsed,
      totalGpu,
      totalNodes,
      totalGpuNodes,
      totalCpuNodes,
    };
  }, [systems]);

  const cpuPercentage =
    stats.totalCores > 0
      ? Math.round((stats.totalCoresUsed / stats.totalCores) * 100)
      : 0;
  const gpuPercentage =
    stats.totalGpu > 0
      ? Math.round((stats.totalGpuUsed / stats.totalGpu) * 100)
      : 0;
  const memoryPercentage =
    stats.totalMemory > 0
      ? Math.round((stats.totalMemoryUsed / stats.totalMemory) * 100)
      : 0;

  return (
    <div>
      <div className="flex gap-2 mx-auto justify-center items-center mb-10">
        <div className="w-[250px] h-[200px]">
          <RadialChart
            value={cpuPercentage}
            maxValue={100}
            label="CPU % Allocated"
          />
        </div>
        <div className="w-[250px] h-[200px]">
          <RadialChart
            value={gpuPercentage}
            maxValue={100}
            label="GPU % Allocated"
          />
        </div>
        <div className="w-[250px] h-[200px]">
          <RadialChart
            value={memoryPercentage}
            maxValue={100}
            label="Memory % Allocated"
          />
        </div>
      </div>
    </div>
  );
}
