"use client";
import { Gauge } from "@/components/ui/gauge";
import React from "react";

interface Node {
  alloc_memory: number;
  real_memory: number;
  alloc_cpus: number;
  cpus: number;
  gres: string | null; // assuming 'gres' can be null if not a GPU node
  gres_used: string;
}

export default function Stats({ data }: any) {
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
        const gpuUsed = parseInt(
          node.gres_used.match(/:(\d+)/)?.[1] || "0",
          10
        );
        const gpuTotal = parseInt(node.gres.match(/:(\d+)/)?.[1] || "0", 10);
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

  return (
    <div>
      <div className="flex gap-2 mx-auto justify-center items-center mt-10 mb-5">
        <div className="w-[250px] h-[200px]">
          <Gauge
            showValue
            size="large"
            value={Math.round((stats.totalCoresUsed / stats.totalCores) * 100)}
          />
          <p className="mx-auto text-center mt-5 text-xl font-extralight tracking-tighter">
            CPU % Allocated
          </p>
        </div>
        <div className="w-[250px] h-[200px]">
          <Gauge
            showValue
            size="large"
            value={Math.round((stats.totalGpuUsed / stats.totalGpu) * 100)}
          />
          <p className="mx-auto text-center mt-5 text-xl font-extralight tracking-tighter">
            GPU % Allocated
          </p>
        </div>
        <div className="w-[250px] h-[200px]">
          <Gauge
            showValue
            size="large"
            value={Math.round(
              (stats.totalMemoryUsed / stats.totalMemory) * 100
            )}
          />
          <p className="mx-auto text-center mt-5 text-xl font-extralight tracking-tighter">
            Memory % Allocated
          </p>
        </div>
      </div>
    </div>
  );
}
