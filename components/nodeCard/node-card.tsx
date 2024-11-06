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

const calculateTotalGPUUsage = (
  gres: string,
  gresUsed: string
): GPUUsageData => {
  return parseGPUResources(gres, gresUsed);
};

const SmallCardContent: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex m-auto items-center justify-center w-full h-full">
    <div className="text-[12px]">{name}</div>
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
      <div className="p-1">
        <div className="font-bold text-[10px] mb-.5">{name}</div>
        <p className="font-light text-[9px]">
          CPU: {coresUsed} / {coresTotal}
        </p>
        <p className="font-light text-[9px]">
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
    <div className="flex flex-col h-full p-1">
      <div className="flex-grow">
        <div className="font-bold text-[12px] mb-1 truncate max-w-[140px]">
          {name}
        </div>
        <p className="font-light text-[10px]">
          CPU: {coresUsed} / {coresTotal}
        </p>
        <p className="font-light text-[10px]">
          MEM: {(memoryUsed / 1024).toFixed(0)} /{" "}
          {(memoryTotal / 1024).toFixed(0)}
        </p>
        <p className="font-light text-[10px]">
          Load: {(nodeData.cpu_load / coresTotal).toFixed(2)}
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

const getStatusColor = (status: string): string => {
  const statusLevel = status[1] || status[0];
  const colorMap: { [key: string]: string } = {
    DRAIN: "bg-blue-400",
    NOT_RESPONDING: "bg-blue-400",
    DOWN: "bg-blue-400",
    IDLE: "bg-green-700",
    MIXED: "bg-orange-800",
    PLANNED: "bg-indigo-500",
    ALLOCATED: "bg-red-900",
    COMPLETING: "bg-yellow-500",
    RESERVED: "bg-indigo-800",
    FUTURE: "bg-emerald-500",
    REBOOT_REQUESTED: "bg-stone-500",
  };
  return colorMap[statusLevel] || "bg-gray-900";
};

export const NodeCard = (props: NodeCardProps) => {
  const [open, setOpen] = useState(false);
  const color = getStatusColor(props.status);
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
          className={`border-[1px] cursor-pointer m-0.5 p-1 rounded-[5px] text-card-foreground shadow-xl ${color} ${
            props.size === 50
              ? "w-[60px] h-[60px]"
              : props.size === 100
              ? "w-[90px] h-[90px]"
              : props.size === 150
              ? "w-[130px] h-[100px]"
              : "w-[100px] h-[100px]"
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
