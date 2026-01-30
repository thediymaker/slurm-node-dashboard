import React from "react";
import { GPUUsageProps } from "@/types/types";

const GPUUsageDisplay = ({ gpuUsed, gpuTotal }: GPUUsageProps) => {
  const usagePercentage = Math.min((gpuUsed / gpuTotal) * 100, 100);

  return (
    <div className="space-y-0.5">
      {/* GPU Label and Count */}
      <div className="flex items-center justify-between text-[9px] opacity-90">
        <span>GPU</span>
        <span>{gpuUsed}/{gpuTotal}</span>
      </div>

      {/* Always use progress bar for consistency */}
      <div className="h-1 w-full bg-black/20 rounded-[1px] overflow-hidden">
        <div
          className="h-full bg-white/80 transition-all duration-300"
          style={{ width: `${usagePercentage}%` }}
        />
      </div>
    </div>
  );
};

export default GPUUsageDisplay;
