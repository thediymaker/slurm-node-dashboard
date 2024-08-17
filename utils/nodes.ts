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

export interface Job {
  job_id: string;
  array?: {
    task_id: {
      set: boolean;
      number: number;
    };
    job_id: string;
  };
  user: string;
  name: string;
  partition: string;
  group: string;
  qos: string;
  time: {
    start: number;
  };
  state: {
    current: string[];
  };
}

export interface JobDetails extends Job {
  nodes: string;
  command: string;
  job_state: string[];
  start_time: { number: number };
  end_time: { number: number };
  cpus_per_task: { number: number };
  memory_per_node: { number: number };
  gres_detail: string[];
  standard_output: string;
  user_name: string;
  group_name: string;
  job_resources: {
    allocated_cores: number;
    allocated_nodes: { nodename: string }[];
  };
  flags: string[];
  standard_error: string;
  standard_input: string;
  time_limit: { number: number };
  priority: { number: number };
}

export interface NodeCardModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  nodename: string;
}

export interface HistoricalJobDetailModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  searchID: string;
}

export interface JobDetailModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  searchID: string;
}

export interface RunningJob {
  job_id: string;
  name: string;
  nodes: string;
  command?: string;
  job_state?: string[];
  start_time?: { number: number };
  end_time?: { number: number };
  cpus_per_task?: { number: number };
  memory_per_node?: { number: number };
  gres_detail?: string[];
  standard_output?: string;
  user_name?: string;
  group_name?: string;
  partition?: string;
  job_resources?: {
    allocated_cores: number;
    allocated_nodes: { nodename: string }[];
  };
  flags?: string[];
  standard_error?: string;
  standard_input?: string;
  time_limit?: { number: number };
  priority?: { number: number };
}

export interface HistoricalJob {
  job_id: number;
  name: string;
  account: string;
  user: string;
  group: string;
  state: {
    current: string[];
    reason: string;
  };
  partition: string;
  qos: string;
  priority: {
    set: boolean;
    infinite: boolean;
    number: number;
  };
  time: {
    eligible: number;
    start: number;
    end: number;
    suspended: number;
    elapsed: number;
    limit: {
      set: boolean;
      infinite: boolean;
      number: number;
    };
    user: number;
    system: number;
  };
  nodes: string;
  required: {
    CPUs: number;
    memory_per_node: {
      set: boolean;
      infinite: boolean;
      number: number;
    };
  };
  tres: {
    allocated: {
      type: string;
      name: string;
      id: number;
      count: number;
    }[];
    requested: {
      type: string;
      name: string;
      id: number;
      count: number;
    }[];
  };
  exit_code: {
    status: string[];
    return_code: {
      set: boolean;
      infinite: boolean;
      number: number;
    };
  };
  steps: {
    step: {
      id: string;
      name: string;
    };
    nodes: {
      count: number;
      range: string;
      list: string[];
    };
    tasks: {
      count: number;
    };
    time: {
      system: {
        seconds: number;
        microseconds: number;
      };
      user: {
        seconds: number;
        microseconds: number;
      };
      start: {
        set: boolean;
        infinite: boolean;
        number: number;
      };
      end: {
        set: boolean;
        infinite: boolean;
        number: number;
      };
    };
  }[];
  flags: string[];
  working_directory: string;
  submit_line: string;
  stats: {
    tres_usage_in_max: {
      type: string;
      count: number;
    }[];
  };
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

export function parseUsedGpuAllocations(
  gresUsedString: string
): GpuAllocation[] {
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

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function parseGpuInfo(node: Node): {
  gpuUsed: number;
  gpuTotal: number;
} {
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
