"use client";

interface StatsProps {
  totalGpuNodes: number;
  totalCpuNodes: number;
  filteredNodes: number;
  totalNodes: number;
}

export function NodeCount({
  totalGpuNodes,
  totalCpuNodes,
  filteredNodes,
  totalNodes,
}: StatsProps) {
  return (
    <div className="flex items-center gap-6 justify-end mb-4 mr-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">GPU</span>
        <span className="text-sm text-blue-400">{totalGpuNodes}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">CPU</span>
        <span className="text-sm text-blue-400">{totalCpuNodes}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">Showing</span>
        <span className="text-sm text-blue-400">{filteredNodes}</span>
        <span className="text-sm text-zinc-400">of</span>
        <span className="text-sm text-blue-400">{totalNodes}</span>
      </div>
    </div>
  );
}

export default NodeCount;
