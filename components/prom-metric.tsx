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

const metricArray = [
  {
    value: "node_load5",
    label: "5 minute load average",
  },
  {
    value: "node_load15",
    label: "15 minute load average",
  },
  {
    value: "node_vmstat_oom_kill",
    label: "OOM kills",
  },
  {
    value: "node_memory_Active_bytes",
    label: "Memory usage GB",
  },
  {
    value: "node_memory_SwapFree_bytes",
    label: "Swap memory free GB",
  },
  {
    value: "node_network_transmit_drop_total",
    label: "Network transmit drops",
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
          <SelectContent>
            <SelectGroup>
              {metricArray.map((metric) => (
                <SelectItem key={metric.value} value={metric.value}>
                  {metric.label}
                </SelectItem>
              ))}
            </SelectGroup>
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
