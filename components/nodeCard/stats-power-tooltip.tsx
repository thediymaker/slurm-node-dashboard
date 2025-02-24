import React, { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { TooltipProps } from "recharts";
import { createPortal } from "react-dom";
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
  coordinate,
  viewBox,
}) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Extract data early to use in useMemo
  const data = payload?.[0]?.payload as PowerData | undefined;
  const formattedDate = useMemo(
    () =>
      data?.time ? format(new Date(data.time), "MMM d, yyyy HH:mm:ss") : "",
    [data?.time]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipRef.current) {
        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;

        setTooltipPosition({
          x: e.clientX - tooltipWidth - 40, // 20px offset from cursor
          y: e.clientY - tooltipHeight / 2 - 40, // Center vertically
        });
      }
    };

    if (active) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [active]);

  if (!active || !payload || payload.length === 0 || !data) {
    return null;
  }

  const { watts, averageWatts, nodesReporting } = data;

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <Card className="p-4 shadow-xl border border-border bg-popover">
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
    </div>,
    document.body
  );
};
