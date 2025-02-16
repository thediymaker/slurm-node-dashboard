import React, { useMemo } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { TooltipProps } from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

interface PowerData {
  time: number;
  watts: number;
  averageWatts: number;
  nodesReporting: number;
}

interface DataRowProps {
  label: string;
  value: string;
}

const DataRow: React.FC<DataRowProps> = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

export const CustomTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload as PowerData;
  const { time, watts, averageWatts, nodesReporting } = data;
  const formattedDate = useMemo(
    () => format(new Date(time), "MMM d, yyyy HH:mm:ss"),
    [time]
  );

  return (
    <Card className="p-4 shadow-xl border border-border bg-popover transition-all duration-300 transform">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-5 h-5 text-yellow-500" />
        <span className="text-base font-semibold">{formattedDate}</span>
      </div>
      <div className="space-y-2">
        <DataRow
          label="Total Power:"
          value={`${(watts / 1000).toFixed(0)} kW`}
        />
        <DataRow
          label="Average per Node:"
          value={`${averageWatts.toFixed(0)} W`}
        />
        <DataRow label="Nodes Reporting:" value={`${nodesReporting}`} />
      </div>
    </Card>
  );
};
