import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import NodeCardModal from "../modals/card-job-modal";
import {
  getStatusDef,
  parseGpuAllocations,
  parseUsedGpuAllocations,
  BaseCardProps,
} from "@/utils/nodes";

function CardContent(props: BaseCardProps) {
  return (
    <div className="">
      <p className="font-extralight text-[10px]">
        CPU: {props.coresUsed} / {props.coresTotal}
      </p>
      <p className="font-extralight text-[10px]">
        MEM: {(props.memoryUsed / 1024).toFixed(0)} /{" "}
        {(props.memoryTotal / 1024).toFixed(0)}
      </p>
      {props.gpuUsed !== undefined &&
        props.gpuTotal !== undefined &&
        props.gpuTotal !== 0 && (
          <p className="font-extralight text-[10px]">
            GPU: {props.gpuUsed} / {props.gpuTotal}
          </p>
        )}
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

export const BasicNodeCard = ({
  name,
  coresTotal,
  status,
  nodeData,
}: BaseCardProps) => {
  const [open, setOpen] = useState(false);
  const color = getStatusColor(status);
  const statusDef = getStatusDef(status);
  const gpuAllocations = parseGpuAllocations(nodeData.gres);
  const usedGpuAllocations = parseUsedGpuAllocations(nodeData.gres_used);

  if (status[1]) {
    status = status[1];
  } else {
    status = status[0];
  }

  const openModal = () => {
    setOpen(!open);
  };

  const cpuLoad = (nodeData.cpu_load / coresTotal).toFixed(2);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div
          className={`border-[1px] cursor-pointer m-0.5 p-1 rounded-[5px] bg-card text-card-foreground shadow-xl w-full sm:w-[60px] sm:h-[60px] ${color}`}
          onClick={openModal}
        >
          <div className="flex m-auto items-center justify-center w-full h-full">
            <div className="text-[12px]">{name}</div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 m-5 font-extralight text-sm">
        <div>Hostname: {nodeData.hostname}</div>
        <div>CPU Load: {cpuLoad} %</div>
        <div className="flex flex-wrap items-center">
          Features:
          {nodeData.features.map((feature: any, index: any) => (
            <div
              className="p-1 border-2 rounded-lg m-1 text-sm font-extralight"
              key={index}
            >
              {feature}
            </div>
          ))}
        </div>
        <div className="flex w-full items-center">
          Partitions:
          {nodeData.partitions.map((partition: any, index: any) => (
            <div
              className="p-1 border-2 rounded-lg m-1 text-sm font-extralight w-fit"
              key={index}
            >
              {partition}
            </div>
          ))}
        </div>
        {nodeData.gres === "" ? null : (
          <>
            <div className="flex w-full items-center">
              GPUs (Total):
              {gpuAllocations.map((gpu, index) => (
                <div
                  className="p-1 border-2 rounded-lg m-1 text-sm font-extralight w-fit"
                  key={index}
                >
                  {gpu.type} (
                  <span className="text-red-500 font-bold">{gpu.count}</span>)
                </div>
              ))}
            </div>
            <div className="flex w-full items-center">
              GPUs (Used):
              {usedGpuAllocations
                .filter((gpu) => gpu.indexRange !== undefined)
                .map((gpu, index) => (
                  <div
                    className="p-1 border-2 rounded-lg m-1 text-sm font-extralight"
                    key={index}
                  >
                    {gpu.type} (
                    <span className="text-red-500 font-bold">{gpu.count}</span>)
                  </div>
                ))}
            </div>
          </>
        )}
        <div>
          Note:
          <div className="p-1 border-2 rounded-lg m-1 text-sm font-extralight">
            {statusDef}
          </div>
          {nodeData.reason === "" ? null : (
            <>
              Reason:
              <div className="p-1 border-2 rounded-lg m-1 text-sm font-extralight">
                {nodeData.reason}
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
      <NodeCardModal open={open} setOpen={setOpen} nodename={name} />
    </HoverCard>
  );
};

export default BasicNodeCard;
