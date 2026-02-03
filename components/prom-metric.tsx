import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PromComboBoxProps } from "@/types/types";

const metricGroups = [
  {
    label: "CPU & Load",
    metrics: [
      { value: "node_load5", label: "5 min load average" },
      { value: "node_load15", label: "15 min load average" },
      { value: "node_procs_running", label: "Running processes" },
      { value: "node_procs_blocked", label: "Blocked processes (I/O)" },
    ],
  },
  {
    label: "Memory",
    metrics: [
      { value: "node_memory_Active_bytes", label: "Active memory (GB)" },
      { value: "node_memory_MemAvailable_bytes", label: "Available memory (GB)" },
      { value: "node_memory_SwapFree_bytes", label: "Swap free (GB)" },
      { value: "node_vmstat_oom_kill", label: "OOM kills" },
    ],
  },
  {
    label: "Network",
    metrics: [
      { value: "node_network_receive_bytes_total", label: "Network RX (MB/s)" },
      { value: "node_network_transmit_bytes_total", label: "Network TX (MB/s)" },
    ],
  },
  {
    label: "Temperature",
    metrics: [
      { value: "node_hwmon_temp_celsius", label: "CPU package temp (°F)" },
      { value: "DCGM_FI_DEV_GPU_TEMP", label: "GPU temp (°F)" },
    ],
  },
  {
    label: "GPU (DCGM)",
    metrics: [
      { value: "DCGM_FI_DEV_GPU_UTIL", label: "GPU utilization %" },
      { value: "DCGM_FI_DEV_MEM_COPY_UTIL", label: "GPU memory util %" },
      { value: "DCGM_FI_DEV_FB_USED", label: "GPU memory used (GB)" },
      { value: "DCGM_FI_DEV_POWER_USAGE", label: "GPU power (W)" },
    ],
  },
];

const dayArray = [
  {
    value: "1",
    label: "1 day",
  },
  {
    value: "3",
    label: "3 days",
  },
  {
    value: "7",
    label: "7 days",
  },
  {
    value: "15",
    label: "15 days",
  },
  {
    value: "30",
    label: "30 days",
  },
];

export default function PromComboBox({
  metricValue,
  setMetricValue,
  daysValue,
  setDaysValue,
}: PromComboBoxProps) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Metric</span>
        <Select
          defaultValue={metricValue}
          onValueChange={(value) => {
            setMetricValue(value);
          }}
        >
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Select a metric" />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {metricGroups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-xs text-muted-foreground font-semibold">
                  {group.label}
                </SelectLabel>
                {group.metrics.map((metric) => (
                  <SelectItem key={metric.value} value={metric.value}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Time</span>
        <Select
          defaultValue={daysValue}
          onValueChange={(value) => {
            setDaysValue(value);
          }}
        >
          <SelectTrigger className="w-[100px] h-9">
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {dayArray.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
