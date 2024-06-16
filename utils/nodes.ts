
export interface BaseCardProps {
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