import { useState, memo, useMemo } from "react";
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
import { ShineBorder } from "@/components/ui/shine-border";

const calculateTotalGPUUsage = (
  gres: string,
  gresUsed: string
): GPUUsageData => {
  return parseGPUResources(gres, gresUsed);
};

// Compact progress bar component - memoized to prevent re-renders
const MiniProgressBar = memo(({
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
    <div className="h-1 w-full bg-black/20 rounded-[1px] overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
});
MiniProgressBar.displayName = "MiniProgressBar";

// Dynamic name sizing based on length - memoized lookup
const nameSizeClasses = {
  short: "text-[12px]",
  medium: "text-[11px]",
  long: "text-[10px]",
  veryLong: "text-[9px]",
} as const;

const getNameSizeClass = (name: string) => {
  const len = name.length;
  if (len <= 6) return nameSizeClasses.short;
  if (len <= 10) return nameSizeClasses.medium;
  if (len <= 14) return nameSizeClasses.long;
  return nameSizeClasses.veryLong;
};

const SmallCardContent = memo<{ name: string }>(({ name }) => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="font-bold text-[10px] tracking-wide truncate text-center">
      {name}
    </div>
  </div>
));
SmallCardContent.displayName = "SmallCardContent";

const MediumCardContent = memo(({
  name,
  coresUsed,
  coresTotal,
  memoryUsed,
  memoryTotal,
  nodeData,
  compact = false,
}: NodeCardProps & { compact?: boolean }) => {
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
    <div className="flex flex-col h-full p-2 gap-1">
      {/* Header - dynamic sizing for long names */}
      <div 
        className={`font-bold leading-tight uppercase ${getNameSizeClass(name)}`}
        title={name}
      >
        {name}
      </div>

      {/* Stats - align top with consistent spacing */}
      <div className="flex-1 flex flex-col justify-start gap-0.5 min-h-0 leading-tight">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] leading-tight opacity-90">
            <span>CPU</span>
            <span>{cpuPercent}%</span>
          </div>
          <MiniProgressBar value={coresUsed} max={coresTotal} />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] leading-tight opacity-90">
            <span>MEM</span>
            <span>{memPercent}%</span>
          </div>
          <MiniProgressBar value={memoryUsed} max={memoryTotal} />
        </div>

        {/* Show LOAD on CPU-only nodes, GPU on GPU nodes */}
        {gpuTotal > 0 ? (
          <GPUUsageDisplay gpuUsed={gpuUsed} gpuTotal={gpuTotal} />
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[9px] leading-tight opacity-90">
              <span>LOAD</span>
              <span>{loadPercent}%</span>
            </div>
            <MiniProgressBar value={actualLoad} max={coresTotal} />
          </div>
        )}
      </div>
    </div>
  );
});
MediumCardContent.displayName = "MediumCardContent";

const LargeCardContent = memo(({
  name,
  coresUsed,
  coresTotal,
  memoryUsed,
  memoryTotal,
  nodeData,
  compact = false,
}: NodeCardProps & { compact?: boolean }) => {
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
    <div className="flex flex-col h-full p-2 gap-1">
      {/* Header - dynamic sizing for long names */}
      <div 
        className={`font-bold leading-tight uppercase ${getNameSizeClass(name)}`}
        title={name}
      >
        {name}
      </div>

      {/* Stats - align top with consistent spacing */}
      <div className="flex-1 flex flex-col justify-start gap-0.5 min-h-0 leading-tight">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] leading-tight opacity-90">
            <span>CPU</span>
            <span>{cpuPercent}%</span>
          </div>
          <MiniProgressBar value={coresUsed} max={coresTotal} />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] leading-tight opacity-90">
            <span>MEM</span>
            <span>{memPercent}%</span>
          </div>
          <MiniProgressBar value={memoryUsed} max={memoryTotal} />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] leading-tight opacity-90">
            <span>LOAD</span>
            <span>{loadPercent}%</span>
          </div>
          <MiniProgressBar value={actualLoad} max={coresTotal} />
        </div>

        {/* GPU Display - integrated into stats flow */}
        {gpuTotal > 0 && (
          <GPUUsageDisplay gpuUsed={gpuUsed} gpuTotal={gpuTotal} />
        )}
      </div>
    </div>
  );
});
LargeCardContent.displayName = "LargeCardContent";

export const NodeCard = memo(({
  colorSchema = "default",
  ...props
}: NodeCardProps & { colorSchema?: string }) => {
  const [open, setOpen] = useState(false);
  
  // Memoize expensive calculations
  const { bgColor, textColor } = useMemo(
    () => getStatusColor(props.status, colorSchema),
    [props.status, colorSchema]
  );
  const statusDef = useMemo(() => getStatusDef(props.status), [props.status]);
  
  // cpu_load from Slurm API is scaled by 100 (3025 = 30.25)
  const cpuLoad = useMemo(
    () => parseFloat(((props.nodeData.cpu_load / 100) / props.coresTotal).toFixed(2)),
    [props.nodeData.cpu_load, props.coresTotal]
  );

  const openModal = () => {
    setOpen(!open);
  };

  const cardContent = useMemo(() => {
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
  }, [props]);

  const sizeClasses = useMemo(() => 
    props.size === 50
      ? "w-[85px] h-[25px]"
      : props.size === 100
        ? "w-[100px] h-[100px]"
        : props.size === 150
          ? "w-[100px] h-[120px]"
          : "w-[100px] h-[100px]",
    [props.size]
  );

  const isOverloaded = cpuLoad > 1.25;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div
          data-node-id={props.nodeData.hostname || props.name}
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
          <div className="relative h-full w-full">{cardContent}</div>

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
});
NodeCard.displayName = "NodeCard";

export default NodeCard;
