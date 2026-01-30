import React from "react";
import { GPUUsageProps } from "@/types/types";

const GPUUsageDisplay = ({ gpuUsed, gpuTotal }: GPUUsageProps) => {
  // Create array of GPU slots
  const gpuSlots = Array.from({ length: gpuTotal }, (_, i) => i < gpuUsed);
  const usagePercentage = Math.min((gpuUsed / gpuTotal) * 100, 100);

  // Use progress bar if more than 8 GPUs
  const useProgressBar = gpuTotal > 8;

  return (
    <div className="pb-1">
      {/* GPU Label and Count */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] font-medium opacity-90 flex items-center gap-0.5">
          <svg
            className="w-2 h-2"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 4h16v12H4V4zm2 2v8h12V6H6zm-2 12v2h16v-2H4zm4-10h2v2H8V8zm4 0h2v2h-2V8zm4 0h2v2h-2V8z" />
          </svg>
          GPU
        </span>
        <span className="text-[8px] font-medium">
          {gpuUsed}/{gpuTotal}
        </span>
      </div>

      {useProgressBar ? (
        /* Progress bar for > 8 GPUs */
        <div className="h-1.5 w-full bg-black/20 rounded-[1px] overflow-hidden">
          <div
            className="h-full bg-white/90 transition-all duration-300"
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      ) : (
        /* GPU Slots - square blocks for <= 8 GPUs */
        <div className="flex gap-[2px]">
          {gpuSlots.map((isUsed, index) => (
            <div
              key={index}
              className={`
                w-[8px] h-[8px] rounded-[1px]
                transition-all duration-300
                ${isUsed
                  ? "bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.5)]"
                  : "bg-black/30 border border-white/20"
                }
              `}
              title={`GPU ${index}: ${isUsed ? "In Use" : "Available"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GPUUsageDisplay;
