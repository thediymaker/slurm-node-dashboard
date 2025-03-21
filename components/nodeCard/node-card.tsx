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

const calculateTotalGPUUsage = (
  gres: string,
  gresUsed: string
): GPUUsageData => {
  return parseGPUResources(gres, gresUsed);
};

const SmallCardContent: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="w-full px-1">
      <div className="font-extrabold text-[10px] mb-.5 truncate text-center">
        {name}
      </div>
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-1 space-y-1">
        <div className="w-full">
          <div className="font-extrabold text-[10px] leading-tight uppercase truncate">
            {name}
          </div>
        </div>
        <p className="text-[9px] leading-none">
          CPU: {coresUsed} / {coresTotal}
        </p>
        <p className="text-[9px] leading-none">
          MEM: {(memoryUsed / 1024).toFixed(0)} /{" "}
          {(memoryTotal / 1024).toFixed(0)}
        </p>
      </div>
      {gpuTotal > 0 && (
        <div className="mt-auto mb-1">
          <GPUUsageDisplay gpuUsed={gpuUsed} gpuTotal={gpuTotal} />
        </div>
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-1 space-y-1">
        <div className="w-full">
          <div className="font-extrabold text-[10px] leading-tight uppercase truncate">
            {name}
          </div>
        </div>
        <p className="text-[9px] leading-none">
          CPU: {coresUsed} / {coresTotal}
        </p>
        <p className="text-[9px] leading-none">
          MEM: {(memoryUsed / 1024).toFixed(0)} /{" "}
          {(memoryTotal / 1024).toFixed(0)}
        </p>
        <p className="text-[9px] leading-none">
          LOAD: {(nodeData.cpu_load / coresTotal).toFixed(2)}
        </p>
      </div>
      {gpuTotal > 0 && (
        <div className="mt-auto">
          <GPUUsageDisplay gpuUsed={gpuUsed} gpuTotal={gpuTotal} />
        </div>
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
  const cpuLoad = parseFloat(
    (props.nodeData.cpu_load / props.coresTotal).toFixed(2)
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

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div
          className={`border-[1px] cursor-pointer m-0.5 p-1 rounded-[5px] shadow-xl ${bgColor} ${textColor} ${
            props.size === 50
              ? "w-[85px] h-[25px]"
              : props.size === 100
              ? "w-[85px] h-[85px]"
              : props.size === 150
              ? "w-[85px] h-[100px]"
              : "w-[85px] h-[85px]"
          } ${cpuLoad > 125 ? "animate-pulse border-black" : ""}`}
          onClick={props.historical ? undefined : openModal}
        >
          <div className="items-center justify-center h-full w-full">
            <div className="h-full w-full">{cardContent()}</div>
          </div>
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
