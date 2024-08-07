import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import NodeCardModal from "@/components/modals/card-job-modal";
import {
  getStatusDef,
  parseGpuAllocations,
  parseUsedGpuAllocations,
} from "@/utils/nodes";
import CardHover from "./card-hover";
import IconComponent from "./gpu-icon";

function SmallCardContent(props: any) {
  return (
    <div className="flex m-auto items-center justify-center w-full h-full">
      <div className="text-[12px]">{props.name}</div>
    </div>
  );
}

function MediumCardContent(props: any) {
  return (
    <div className="p-1">
      <div className="font-bold text-[12px] mb-.5">{props.name}</div>
      <p className="font-extralight text-[9px]">
        CPU: {props.coresUsed} / {props.coresTotal}
      </p>
      <p className="font-extralight text-[9px]">
        MEM: {(props.memoryUsed / 1024).toFixed(0)} /{" "}
        {(props.memoryTotal / 1024).toFixed(0)}
      </p>
      {props.gpuUsed !== undefined &&
        props.gpuTotal !== undefined &&
        props.gpuTotal !== 0 && (
          <p className="font-extralight text-[9px]">
            GPU: {props.gpuUsed} / {props.gpuTotal}
          </p>
        )}
    </div>
  );
}

function LargeCardContent(props: any) {
  return (
    <div className="p-1">
      <div className="font-bold text-[14px] mb-1">{props.name}</div>
      <p className="font-extralight text-[10px]">
        CPU: {props.coresUsed} / {props.coresTotal}
      </p>
      <p className="font-extralight text-[10px]">
        MEM: {(props.memoryUsed / 1024).toFixed(0)} /{" "}
        {(props.memoryTotal / 1024).toFixed(0)}
      </p>
      <p className="font-extralight text-[10px]">
        Load: {(props.nodeData.cpu_load / props.coresTotal).toFixed(2)}
      </p>
      <IconComponent num_used={props.gpuUsed} num_total={props.gpuTotal} />
    </div>
  );
}

export function getStatusColor(status: string): string {
  const statusLevel = status[1] || status[0];
  switch (statusLevel) {
    case "DRAIN":
    case "NOT_RESPONDING":
    case "DOWN":
      return "bg-blue-400";
    case "IDLE":
      return "bg-green-700";
    case "MIXED":
      return "bg-orange-800";
    case "PLANNED":
      return "bg-indigo-500";
    case "ALLOCATED":
      return "bg-red-900";
    case "COMPLETING":
      return "bg-yellow-500";
    case "RESERVED":
      return "bg-indigo-800";
    case "FUTURE":
      return "bg-emerald-500";
    case "REBOOT_REQUESTED":
      return "bg-stone-500";
    default:
      return "bg-gray-900";
  }
}

export const NodeCard = (props: any) => {
  const [open, setOpen] = useState(false);
  const color = getStatusColor(props.status);
  const statusDef = getStatusDef(props.status);
  const gpuAllocations = parseGpuAllocations(props.nodeData.gres);
  const usedGpuAllocations = parseUsedGpuAllocations(props.nodeData.gres_used);
  const openModal = () => {
    setOpen(!open);
  };

  const cpuLoad = parseFloat(
    (props.nodeData.cpu_load / props.coresTotal).toFixed(2)
  );

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
              ? "w-[130px] h-[130px]"
              : "w-[100px] h-[100px]"
          } ${cpuLoad > 125 ? "animate-pulse border-black" : ""}`}
          onClick={openModal}
        >
          <div className="items-center justify-center h-full w-full">
            <div className="h-full w-full">
              {props.size === 50 ? (
                <SmallCardContent {...props} />
              ) : props.size === 100 ? (
                <MediumCardContent {...props} />
              ) : props.size === 150 ? (
                <LargeCardContent {...props} />
              ) : (
                <MediumCardContent {...props} />
              )}
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 m-5 font-extralight text-sm">
        <CardHover
          nodeData={props.nodeData}
          cpuLoad={cpuLoad}
          gpuAllocations={gpuAllocations}
          usedGpuAllocations={usedGpuAllocations}
          statusDef={statusDef}
        />
      </HoverCardContent>
      <NodeCardModal open={open} setOpen={setOpen} nodename={props.name} />
    </HoverCard>
  );
};

export default NodeCard;
