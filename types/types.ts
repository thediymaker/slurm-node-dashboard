// Node and Resource Related Interfaces
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

export interface NodeConfig {
  [group: string]: {
    nodes: string[];
    description?: string;
  };
}

export interface NodeData {
  hostname: string;
  features: string[];
  partitions: string[];
  gres: string;
  gres_used: string;
  alloc_memory: number;
  real_memory: number;
  alloc_cpus: number;
  cpus: number;
  reason?: string;
  energy: {
    current_watts: {
      number: number;
      set: boolean;
    };
    average_watts: number;
    consumed_energy: number;
    last_collected: number;
  };
}

export interface GPUResource {
  type: string;
  total: number;
  used: number;
  shardsTotal: number;
  shardsUsed: number;
}

export interface GPUResources {
  slices: {
    total: Record<string, number>;
    used: Record<string, number>;
  };
  sliceType: "SHARD" | "MIG" | "NOSLICE";
}

export interface GpuAllocation {
  type: string;
  count: number;
  indexRange?: string;
}

// Job Related Interfaces
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
  submit_time?: { number: number };
  cpus_per_task: { number: number };
  cpus?: { number: number };
  memory_per_node: { number: number };
  memory_per_cpu?: { number: number };
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
  current_working_directory?: string;
  state_reason?: string;
  tres_req_str?: string;
  partition?: string;
  qos?: string;
}

export interface RunningJob extends Partial<JobDetails> {
  job_id: string;
  name: string;
  nodes: string;
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
  allocation_nodes: number;
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
    stats: {
      tres_usage_in_max: {
        type: string;
        count: number;
      }[];
    };
    nodes: {
      count: number;
      range: string;
      list: string[];
    };
    tasks: {
      count: number;
    };
    tres: {
      requested: {
        max: any;
      };
      consumed: any;
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

// Component Props Interfaces
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

export interface SystemHealthProps {
  status: string;
}

export interface CardSkeletonProps {
  qty: number;
  size: number;
}

export interface GPUUsageProps {
  gpuUsed: number;
  gpuTotal: number;
}

export interface NodeCardProps {
  name: string;
  status: string | string[];
  coresUsed: number;
  coresTotal: number;
  memoryUsed: number;
  nodeData: any;
  partitions: string | string[];
  features: string | string[];
  memoryTotal: number;
  load?: number;
  size: any;
  historical?: boolean;
}

export interface CardHoverProps {
  nodeData: NodeData;
  cpuLoad: number;
  statusDef: string;
}

export interface PromComboBoxProps {
  metricValue: string;
  setMetricValue: (value: string) => void;
  daysValue: string;
  setDaysValue: (value: string) => void;
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

// Prometheus and Metrics Related Interfaces
export interface GPUUsageData {
  resources: string;
  gpuUsed: number;
  gpuTotal: number;
  isMIG: boolean;
}

export interface SampleValue {
  time: Date;
  value: number;
}

export interface PrometheusQueryResponse {
  resultType: string;
  result: Array<{
    metric: {
      name: string;
      labels: Record<string, string>;
    };
    values: SampleValue[];
  }>;
}

export interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  time: string | undefined;
  setTime: (time: string | undefined) => void;
}

// Diag Interface
export interface SlurmDiag {
  statistics: {
    parts_packed: number;
    req_time: {
      set: boolean;
      infinite: boolean;
      number: number;
    };
    req_time_start: {
      set: boolean;
      infinite: boolean;
      number: number;
    };
    server_thread_count: number;
    agent_queue_size: number;
    agent_count: number;
    agent_thread_count: number;
    dbd_agent_queue_size: number;
    gettimeofday_latency: number;
    schedule_cycle_max: number;
    schedule_cycle_last: number;
    schedule_cycle_total: number;
    schedule_cycle_mean: number;
    schedule_cycle_mean_depth: number;
    schedule_cycle_per_minute: number;
    schedule_queue_length: number;
    jobs_submitted: number;
    jobs_started: number;
    jobs_completed: number;
    jobs_canceled: number;
    jobs_failed: number;
    jobs_pending: number;
    jobs_running: number;
    bf_backfilled_jobs: number;
    bf_last_backfilled_jobs: number;
    bf_backfilled_het_jobs: number;
    bf_cycle_counter: number;
    bf_cycle_mean: number;
    bf_depth_mean: number;
    bf_depth_mean_try: number;
    bf_cycle_sum: number;
    bf_cycle_last: number;
    bf_last_depth: number;
    bf_last_depth_try: number;
    bf_depth_sum: number;
    bf_depth_try_sum: number;
    bf_queue_len: number;
    bf_queue_len_mean: number;
    bf_queue_len_sum: number;
    bf_table_size: number;
    bf_table_size_mean: number;
    bf_active: boolean;
    rpcs_by_message_type: {
      message_type: string;
      type_id: number;
      count: number;
      average_time: number;
      total_time: number;
    }[];
    rpcs_by_user: {
      user: string;
      user_id: number;
      count: number;
      average_time: number;
      total_time: number;
    }[];
  };
  meta: {
    plugin: {
      type: string;
      name: string;
      data_parser: string;
      accounting_storage: string;
    };
    client: {
      source: string;
      user: string;
      group: string;
    };
    slurm: {
      version: {
        major: string;
        micro: string;
        minor: string;
      };
      release: string;
      cluster: string;
    };
  };
  errors: string[];
  warnings: string[];
}
