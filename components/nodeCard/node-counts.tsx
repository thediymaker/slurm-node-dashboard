"use client";

import { useEffect, useState, useRef } from "react";
import { Server, Cpu, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsProps {
  totalGpuNodes: number;
  totalCpuNodes: number;
  filteredNodes: number;
  totalNodes: number;
}

export function NodeCount({
  totalGpuNodes,
  totalCpuNodes,
  filteredNodes,
  totalNodes,
}: StatsProps) {
  // Use ref to track previous value to animate from
  const [animatedFiltered, setAnimatedFiltered] = useState(filteredNodes);
  const prevFilteredRef = useRef(filteredNodes);

  // Calculate percentage of filtered nodes relative to total
  const filterPercentage =
    totalNodes > 0 ? (filteredNodes / totalNodes) * 100 : 0;

  // Animate between previous and current filtered count when it changes
  useEffect(() => {
    // Skip animation on initial render
    if (prevFilteredRef.current === filteredNodes) {
      return;
    }

    const startValue = prevFilteredRef.current;
    const endValue = filteredNodes;
    const difference = endValue - startValue;

    // Update ref for next animation
    prevFilteredRef.current = filteredNodes;

    // Skip animation if there's no change
    if (difference === 0) return;

    const duration = 600;
    const steps = 12;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      // Calculate current value with linear interpolation
      setAnimatedFiltered(Math.round(startValue + difference * progress));

      if (step >= steps) {
        clearInterval(timer);
        setAnimatedFiltered(endValue);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [filteredNodes]);

  return (
    <div className="relative mb-4">
      <div className="flex items-center justify-end py-2 px-3">
        <div className="flex items-center gap-5">
          {/* GPU Node Count */}
          <div className="flex items-center gap-1.5">
            <MonitorSmartphone className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">GPU</span>
            <span className="text-sm font-medium text-primary">
              {totalGpuNodes}
            </span>
          </div>

          {/* CPU Node Count */}
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">CPU</span>
            <span className="text-sm font-medium text-primary">
              {totalCpuNodes}
            </span>
          </div>

          {/* Filtered Nodes Indicator */}
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Showing</span>
            <span className="text-sm font-medium text-primary">
              {animatedFiltered}
            </span>
            <span className="text-xs text-muted-foreground">of</span>
            <span className="text-sm font-medium">{totalNodes}</span>
          </div>
        </div>
      </div>

      {/* Full-width progress bar at the bottom of the card */}
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-secondary/50 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            filterPercentage === 100
              ? "bg-gradient-to-r from-primary to-primary/90"
              : "bg-gradient-to-r from-primary/80 to-primary/60"
          )}
          style={{ width: `${filterPercentage}%` }}
        />
      </div>
    </div>
  );
}

export default NodeCount;
