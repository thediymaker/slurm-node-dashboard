import React from "react";
import { Progress } from "@/components/ui/progress-green";

interface GPUUsageProps {
  gpuUsed: number;
  gpuTotal: number;
}

const GPUUsageDisplay: React.FC<GPUUsageProps> = ({ gpuUsed, gpuTotal }) => {
  const usagePercentage = Math.min((gpuUsed / gpuTotal) * 100, 100);

  return (
    <div className="w-[90%] mx-auto">
      <Progress value={usagePercentage} className="w-full h-2" />
    </div>
  );
};

export default GPUUsageDisplay;
