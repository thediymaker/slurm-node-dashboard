import IconComponent from "@/components/cards/gpu-icon";
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
  BaseCardProps,
} from "@/utils/nodes";

function CardContent(props: BaseCardProps) {
  return (
    <>
      <p className="font-extralight text-xs">
        CPU: {props.coresUsed} / {props.coresTotal}
      </p>
      <p className="font-extralight text-xs">
        MEM: {props.memoryUsed} / {props.memoryTotal}
      </p>
    </>
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
      return "bg-purple-500";
    case "ALLOCATED":
      return "bg-red-900";
    case "COMPLETING":
      return "bg-yellow-500";
    default:
      return "bg-gray-900";
  }
}

export const NodeCard = ({
  name,
  load,
  partitions,
  features,
  coresUsed,
  coresTotal,
  memoryUsed,
  memoryTotal,
  status,
  gpuUsed,
  gpuTotal,
  nodeData,
  toggleDropdown,
  dropdownOpenStatus,
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

  return (
    <HoverCard>
      <div
        className="border-1 cursor-pointer m-1 p-1 rounded-[5px] bg-card text-card-foreground shadow-xl w-full sm:w-[175px]"
        onClick={openModal}
      >
        <div className="p-1 items-center justify-center">
          <div className="flex justify-between">
            <div className="text-lg font-bold pb-1">{name}</div>
          </div>
          <HoverCardTrigger asChild>
            <div className="text-xs p-1">
              <CardContent
                name={name}
                load={load}
                partitions={partitions}
                features={features}
                coresUsed={coresUsed}
                coresTotal={coresTotal}
                memoryUsed={memoryUsed}
                memoryTotal={memoryTotal}
                status={status}
                gpuUsed={gpuUsed}
                nodeData={nodeData}
                gpuTotal={gpuTotal}
                toggleDropdown={toggleDropdown}
                dropdownOpenStatus={dropdownOpenStatus}
                index={0}
              />

              <IconComponent num_used={gpuUsed} num_total={gpuTotal} />
            </div>
          </HoverCardTrigger>
          <div className="text-sm font-light">
            <p className={`${color} rounded-md text-center mt-2 p-1`}>
              {status}
            </p>
          </div>
        </div>
      </div>
      <HoverCardContent className="w-96 m-5 font-extralight text-sm">
        <div>Hostname: {nodeData.hostname}</div>
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

export default NodeCard;
