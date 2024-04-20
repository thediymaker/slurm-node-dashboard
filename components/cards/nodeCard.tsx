import { SeparatorMed } from "@/components/ui/separator-med";
import IconComponent from "./gpuIcon";
import { MoreHorizontal, SearchIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";

interface BaseCardProps {
  name: string;
  load: number;
  partitions: string;
  features: string;
  coresUsed: number;
  coresTotal: number;
  memoryUsed: number;
  memoryTotal: number;
  status: string;
  data: any;
  gpuUsed: number;
  gpuTotal: number;
  toggleDropdown: (index: number) => void;
  dropdownOpenStatus: any;
  index: number;
}

function getStatusColor(status: string): string {
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
    case "ALLOCATED":
      return "bg-red-900";
    default:
      return "bg-gray-900";
  }
}

function CardContent(props: BaseCardProps) {
  return (
    <>
      <p>
        CPU: {props.coresUsed} / {props.coresTotal}
      </p>
      <p>
        MEM: {props.memoryUsed} / {props.memoryTotal}
      </p>
      {props.gpuUsed !== undefined &&
        props.gpuTotal !== undefined &&
        props.gpuTotal !== 0 && (
          <p>
            GPU: {props.gpuUsed} / {props.gpuTotal}
          </p>
        )}
    </>
  );
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
  data,
  toggleDropdown,
  dropdownOpenStatus,
  index,
}: BaseCardProps) => {
  const [open, setOpen] = useState(false);
  const color = getStatusColor(status);

  if (status[1]) {
    status = status[1];
  } else {
    status = status[0];
  }

  return (
    <HoverCard>
      <div className="border-[1px] m-2 p-2 rounded-[5px] bg-card text-card-foreground shadow-xl w-full sm:w-[200px]">
        <div className="p-1 items-center justify-center">
          <div className="flex justify-between">
            <div className="text-xl font-bold pb-1">{name}</div>
            <div className="text-sm pb-1 cursor-pointer">
              <DropdownMenu
                open={dropdownOpenStatus[index]}
                onOpenChange={() => toggleDropdown(index)}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[175px]">
                  <DropdownMenuLabel>
                    Actions: <span className="uppercase">{name}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <button className="w-full" onClick={() => setOpen(true)}>
                      <DropdownMenuItem className="font-semibold text-gray-200">
                        <SearchIcon className="mr-2 h-4 w-4" />
                        Details
                      </DropdownMenuItem>
                    </button>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <SeparatorMed />{" "}
          <HoverCardTrigger asChild>
            <div className="text-sm p-1">
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
                data={data}
                gpuTotal={gpuTotal}
                toggleDropdown={toggleDropdown}
                dropdownOpenStatus={dropdownOpenStatus}
                index={0}
              />
              <IconComponent num_used={gpuUsed} num_total={gpuTotal} />
            </div>
          </HoverCardTrigger>
          <div className="text-sm font-light">
            <p className={`${color} rounded-[5px] text-center mt-2 p-1`}>
              {status}
            </p>
          </div>
        </div>
      </div>
      <HoverCardContent className="w-80 m-5 font-extralight text-sm">
        <div>Hostname: {data.hostname}</div>
        <div className="flex flex-wrap items-center">
          Features:
          {data.features.map((feature: any, index: any) => (
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
          {data.partitions.map((partition: any, index: any) => (
            <div
              className="p-1 border-2 rounded-lg m-1 text-sm font-extralight"
              key={index}
            >
              {partition}
            </div>
          ))}
        </div>
        {data.owner !== "" && <div>Owner: {data.owner}</div>}
        {gpuTotal !== 0 && <div>GPUs: {data.gres}</div>}
      </HoverCardContent>
    </HoverCard>
  );
};
