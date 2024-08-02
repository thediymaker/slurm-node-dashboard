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

const metricArray = [
  {
    value: "node_load15",
    label: "15 minute load average",
  },
  {
    value: "node_load5",
    label: "5 minute load average",
  },
  {
    value: "node_memory_Active_bytes",
    label: "Memory usage GB",
  },
  {
    value: "node_vmstat_oom_kill",
    label: "OOM kills",
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
];

interface PromComboBoxProps {
  metricValue: string;
  setMetricValue: (value: string) => void;
  daysValue: string;
  setDaysValue: (value: string) => void;
}

export default function PromComboBox({
  metricValue,
  setMetricValue,
  daysValue,
  setDaysValue,
}: PromComboBoxProps) {
  if (!Array.isArray(metricArray) || !Array.isArray(dayArray)) {
    throw new Error("Metrics or Days array is not defined or not an array");
  }

  return (
    <div className="flex gap-5 mb-3 items-center">
      <div className="font-extralight">Metric</div>
      <Select
        defaultValue={metricValue}
        onValueChange={(value) => {
          setMetricValue(value);
        }}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select a metric" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Metric</SelectLabel>
            {metricArray.map((metric) => (
              <SelectItem key={metric.value} value={metric.value}>
                {metric.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="font-extralight">Time</div>
      <Select
        defaultValue={daysValue}
        onValueChange={(value) => {
          setDaysValue(value);
        }}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Select a time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Days</SelectLabel>
            {dayArray.map((day) => (
              <SelectItem key={day.value} value={day.value}>
                {day.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
