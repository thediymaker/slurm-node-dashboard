
export interface BaseCardProps {
  size: number;
  name: string;
  load: number;
  partitions: string;
  features: string;
  coresUsed: number;
  coresTotal: number;
  memoryUsed: number;
  memoryTotal: number;
  status: string;
  nodeData: any;
  gpuUsed: number;
  gpuTotal: number;
  toggleDropdown: (index: number) => void;
  dropdownOpenStatus: any;
  index: number;
}

export interface Node {
  alloc_memory: number;
  real_memory: number;
  alloc_cpus: number;
  cpus: number;
  gres: string;
  gres_used: string;
  partitions: string[];
  features?: string[];
}

export interface GpuAllocation {
  type: string;
  count: number;
  indexRange?: string;
}

export function getStatusDef(status: string): string {
  const statusLevel = status[1] || status[0];
  switch (statusLevel) {
    case "DRAIN":
    case "NOT_RESPONDING":
    case "DOWN":
      return "This System is currently unavailable. This could be due to maintenance, or hardware issues.";
    case "IDLE":
      return "System is idle ready for use.";
    case "MIXED":
      return "System is currently in use, but not fully allocated.";
    case "ALLOCATED":
      return "System is fully allocated.";
    case "COMPLETING":
      return "System is currently in the process of completing a task.";
    case "PLANNED":
      return "System is being prepared for use.";
    case "RESERVED":
      return "System is reserved for maintenance.";
    case "FUTURE":
      return "System is reserved for future use.";
    case "REBOOT_REQUESTED":
      return "System currently has a reboot request pending.";
    default:
      return "System status unknown, this is likely due to the system being offline.";
  }
}

export function parseGpuAllocations(gresString: string): GpuAllocation[] {
  return gresString.split(",").map((item) => {
    const parts = item.split(":");
    const count = parseInt(parts[2], 10);
    return { type: parts[0] + ":" + parts[1], count };
  });
}

export function parseUsedGpuAllocations(gresUsedString: string): GpuAllocation[] {
  return gresUsedString.split(",").map((item) => {
    const [typeAndCount, indexRange] = item.split("(");
    const parts = typeAndCount.split(":");
    const count = parseInt(parts[2], 10);
    return { type: parts[0] + ":" + parts[1], count, indexRange };
  });
}

export function convertUnixToHumanReadable(unixTimestamp: any) {
  const date = new Date(unixTimestamp * 1000);
  const formattedDate = date.toLocaleString();
  return formattedDate;
}

export function parseGpuInfo(node: Node): { gpuUsed: number; gpuTotal: number } {
  const gpuRegex = /gpu:([^:]+):(\d+)/g;

  const gresMatches = [...node.gres.matchAll(gpuRegex)];
  const gresUsedMatches = [...node.gres_used.matchAll(gpuRegex)];

  const gpuUsed = gresUsedMatches.reduce((acc, match) => {
    const type = match[1];
    const quantity = parseInt(match[2], 10);
    const matchingGres = gresMatches.find((m) => m[1] === type);
    return acc + (matchingGres ? quantity : 0);
  }, 0);

  const gpuTotal = gresMatches.reduce((acc, match) => {
    return acc + parseInt(match[2], 10);
  }, 0);

  return { gpuUsed, gpuTotal };
}