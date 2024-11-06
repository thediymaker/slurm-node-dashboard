import React from "react";
import { Progress } from "@/components/ui/progress";
import { GPUUsageProps } from "@/types/types";

const GPUUsageDisplay = ({ gpuUsed, gpuTotal }: GPUUsageProps) => {
  const usagePercentage = Math.min((gpuUsed / gpuTotal) * 100, 100);

  return (
    <div className="w-[90%] mx-auto">
      <Progress value={usagePercentage} className="w-full h-2" />
    </div>
  );
};

export default GPUUsageDisplay;
