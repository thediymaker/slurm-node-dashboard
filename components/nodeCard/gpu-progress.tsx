import React from "react";
import { Progress } from "@/components/ui/progress";

interface GPUUsageProps {
  gpuUsed: number;
  gpuTotal: number;
}

const GPUUsageDisplay: React.FC<GPUUsageProps> = ({ gpuUsed, gpuTotal }) => {
  const usagePercentage = (gpuUsed / gpuTotal) * 100;

  return (
    <div className="w-full items-end">
      <Progress value={usagePercentage} className="w-full h-2" />
    </div>
  );
};

export default GPUUsageDisplay;
