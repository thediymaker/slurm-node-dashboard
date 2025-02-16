import React from "react";
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

export const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as PowerData;
  const date = new Date(data.time);

  return (
    <Card className="p-3 shadow-lg border border-border bg-popover">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-yellow-500" />
        <p className="text-sm font-medium">
          {format(date, "MMM d, yyyy HH:mm:ss")}
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-sm text-muted-foreground">Total Power:</span>
          <span className="text-sm font-medium">{data.watts.toFixed(0)}W</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            Average per Node:
          </span>
          <span className="text-sm font-medium">
            {data.averageWatts.toFixed(0)}W
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            Nodes Reporting:
          </span>
          <span className="text-sm font-medium">{data.nodesReporting}</span>
        </div>
      </div>
    </Card>
  );
};
