import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import NodeCardModal from "@/components/modals/card-job-modal";
import { getStatusDef } from "@/utils/nodes";
import CardHover from "./card-hover";
import GPUUsageDisplay from "./gpu-progress";
import { parseGPUResources } from "@/utils/gpu-parse";
import { GPUUsageData, NodeCardProps } from "@/types/types";
import { getStatusColor } from "@/lib/color-schemas";
import { Cpu, MemoryStick, Activity, MonitorDot } from "lucide-react";
import { ShineBorder } from "@/components/ui/shine-border";

const calculateTotalGPUUsage = (
  gres: string,
  gresUsed: string
): GPUUsageData => {
  return parseGPUResources(gres, gresUsed);
};

// Compact progress bar component
const MiniProgressBar = ({
  value,
  max,
  colorClass = "bg-white/80",
}: {
  value: number;
  max: number;
  colorClass?: string;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 w-full bg-black/20 rounded-[1px] overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const SmallCardContent: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="font-bold text-[10px] tracking-wide truncate text-center">
      {name}
    </div>
  </div>
);

const MediumCardContent = ({
  name,
  coresUsed,
  coresTotal,
  memoryUsed,
  memoryTotal,
  nodeData,
}: NodeCardProps) => {
  const { gpuUsed, gpuTotal } = calculateTotalGPUUsage(
    nodeData.gres,
    nodeData.gres_used
  );
  const cpuPercent = Math.round((coresUsed / coresTotal) * 100);
  const memPercent = Math.round((memoryUsed / memoryTotal) * 100);

  return (
    <div className="flex flex-col h-full p-1.5 gap-0.5">
      {/* Header */}
      <div className="font-bold text-[12px] leading-none uppercase">
        {name}
      </div>

      {/* Stats */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[8px] opacity-90">
            <span className="flex items-center gap-0.5">
              <Cpu size={8} /> CPU
            </span>
            <span>{cpuPercent}%</span>
          </div>
          <MiniProgressBar value={coresUsed} max={coresTotal} />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[8px] opacity-90">
            <span className="flex items-center gap-0.5">
              <MemoryStick size={8} /> MEM
            </span>
            <span>{memPercent}%</span>
          </div>
          <MiniProgressBar value={memoryUsed} max={memoryTotal} />
        </div>
      </div>

      {/* GPU Display */}
      {gpuTotal > 0 && (
        <GPUUsageDisplay gpuUsed={gpuUsed} gpuTotal={gpuTotal} />
      )}
    </div>
  );
};

const LargeCardContent = ({
  name,
  coresUsed,
  coresTotal,
  memoryUsed,
  memoryTotal,
  nodeData,
}: NodeCardProps) => {
  const { gpuUsed, gpuTotal } = calculateTotalGPUUsage(
    nodeData.gres,
    nodeData.gres_used
  );
  const cpuPercent = Math.round((coresUsed / coresTotal) * 100);
  const memPercent = Math.round((memoryUsed / memoryTotal) * 100);
  // cpu_load from Slurm API is scaled by 100 (3025 = 30.25)
  const actualLoad = nodeData.cpu_load / 100;
  const loadPercent = Math.round((actualLoad / coresTotal) * 100);

  return (
    <div className="flex flex-col h-full p-1.5 gap-0.5">
      {/* Header */}
      <div className="font-bold text-[12px] leading-none uppercase">
        {name}
      </div>

      {/* Stats */}
      <div className="flex-1 flex flex-col justify-center gap-0.5">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[8px] opacity-90">
            <span className="flex items-center gap-0.5">
              <Cpu size={8} /> CPU
            </span>
            <span>
              {coresUsed}/{coresTotal}
            </span>
          </div>
          <MiniProgressBar value={coresUsed} max={coresTotal} />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[8px] opacity-90">
            <span className="flex items-center gap-0.5">
              <MemoryStick size={8} /> MEM
            </span>
            <span>
              {(memoryUsed / 1024).toFixed(0)}/{(memoryTotal / 1024).toFixed(0)}G
            </span>
          </div>
          <MiniProgressBar value={memoryUsed} max={memoryTotal} />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[8px] opacity-90">
            <span className="flex items-center gap-0.5">
              <Activity size={8} /> LOAD
            </span>
            <span>{loadPercent}%</span>
          </div>
          <MiniProgressBar
            value={actualLoad}
            max={coresTotal}
            colorClass="bg-white/80"
          />
        </div>
      </div>

      {/* GPU Display */}
      {gpuTotal > 0 && (
        <GPUUsageDisplay gpuUsed={gpuUsed} gpuTotal={gpuTotal} />
      )}
    </div>
  );
};

export const NodeCard = ({
  colorSchema = "default",
  ...props
}: NodeCardProps & { colorSchema?: string }) => {
  const [open, setOpen] = useState(false);
  const { bgColor, textColor } = getStatusColor(props.status, colorSchema);
  const statusDef = getStatusDef(props.status);
  // cpu_load from Slurm API is scaled by 100 (3025 = 30.25)
  const cpuLoad = parseFloat(
    ((props.nodeData.cpu_load / 100) / props.coresTotal).toFixed(2)
  );

  const openModal = () => setOpen(!open);

  const cardContent = () => {
    switch (props.size) {
      case 50:
        return <SmallCardContent name={props.name} />;
      case 100:
        return <MediumCardContent {...props} />;
      case 150:
        return <LargeCardContent {...props} />;
      default:
        return <MediumCardContent {...props} />;
    }
  };

  const sizeClasses =
    props.size === 50
      ? "w-[85px] h-[25px]"
      : props.size === 100
        ? "w-[100px] h-[100px]"
        : props.size === 150
          ? "w-[100px] h-[115px]"
          : "w-[100px] h-[100px]";

  const isOverloaded = cpuLoad > 1.25;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div
          className={`
            relative overflow-hidden cursor-pointer m-0.5 rounded-lg
            ${bgColor} ${textColor} ${sizeClasses}
            shadow-lg hover:shadow-xl
            border border-white/10
            backdrop-blur-sm
            transition-all duration-200 ease-out
            hover:scale-[1.02] hover:brightness-110
          `}
          onClick={props.historical ? undefined : openModal}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none" />

          {/* Content */}
          <div className="relative h-full w-full">{cardContent()}</div>

          {/* Shine border for overloaded nodes */}
          {isOverloaded && (
            <ShineBorder 
              duration={4}
              shineColor={["#ffffff", "#ffffffcc", "#ffffff80"]}
            />
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 m-5 font-extralight text-sm">
        <CardHover
          nodeData={props.nodeData}
          cpuLoad={cpuLoad}
          statusDef={statusDef}
        />
      </HoverCardContent>
      <NodeCardModal open={open} setOpen={setOpen} nodename={props.name} />
    </HoverCard>
  );
};

export default NodeCard;
