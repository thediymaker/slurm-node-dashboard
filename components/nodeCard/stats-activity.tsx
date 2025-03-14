import React, { useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeStats {
  nodeStates: {
    idle: number;
    mixed: number;
    allocated: number;
    down: number;
    drain: number;
    unknown: number;
  };
}

interface SystemActivityBannerProps {
  nodes: any[];
  stats: NodeStats;
  colorSchema: string;
}

const SystemActivityBanner: React.FC<SystemActivityBannerProps> = ({
  nodes,
  stats,
  colorSchema = "default",
}) => {
  const totalNodes = nodes.length;

  // Convert Tailwind color classes to hex for the progress bar
  const getColorFromClass = (colorClass: string): string => {
    const colorMap: Record<string, string> = {
      // Default scheme
      "bg-green-700": "#15803d",
      "bg-orange-800": "#9a3412",
      "bg-red-900": "#7f1d1d",
      "bg-indigo-500": "#6366f1",

      // Neon scheme
      "bg-cyan-400": "#22d3ee",
      "bg-yellow-400": "#facc15",
      "bg-fuchsia-500": "#d946ef",
      "bg-rose-500": "#f43f5e",
      "bg-purple-600": "#9333ea",

      // Nordic scheme
      "bg-emerald-400": "#34d399",
      "bg-indigo-600": "#4f46e5",
      "bg-blue-800": "#1e40af",
      "bg-teal-600": "#0d9488",
      "bg-cyan-500": "#06b6d4",

      // Candy scheme
      "bg-green-400": "#4ade80",
      "bg-purple-500": "#a855f7",
      "bg-red-600": "#dc2626",
      "bg-pink-500": "#ec4899",
      "bg-blue-400": "#60a5fa",

      // Desert scheme
      "bg-amber-300": "#fcd34d",
      "bg-rose-800": "#be185d",
      "bg-purple-800": "#6b21a8",
      "bg-orange-600": "#ea580c",
      "bg-red-500": "#ef4444",

      // Ocean scheme
      "bg-blue-700": "#1d4ed8",
      "bg-indigo-800": "#3730a3",
      "bg-sky-600": "#0284c7",
      "bg-teal-500": "#14b8a6",
    };

    return colorMap[colorClass] || "#6b7280"; // Default to gray if color not found
  };

  // Get status colors based on the current color scheme
  const getStatusColors = useMemo(() => {
    // Definition of colors per state for each color scheme
    const statusColorMap: Record<string, Record<string, string>> = {
      default: {
        idle: getColorFromClass("bg-green-700"),
        mixed: getColorFromClass("bg-orange-800"),
        allocated: getColorFromClass("bg-red-900"),
        down: getColorFromClass("bg-blue-400"),
        drain: getColorFromClass("bg-blue-400"),
        unknown: getColorFromClass("bg-blue-400"),
      },
      neon: {
        idle: getColorFromClass("bg-cyan-400"),
        mixed: getColorFromClass("bg-yellow-400"),
        allocated: getColorFromClass("bg-rose-500"),
        down: getColorFromClass("bg-fuchsia-500"),
        drain: getColorFromClass("bg-fuchsia-500"),
        unknown: getColorFromClass("bg-fuchsia-500"),
      },
      nordic: {
        idle: getColorFromClass("bg-emerald-400"),
        mixed: getColorFromClass("bg-indigo-600"),
        allocated: getColorFromClass("bg-blue-800"),
        down: getColorFromClass("bg-teal-600"),
        drain: getColorFromClass("bg-teal-600"),
        unknown: getColorFromClass("bg-teal-600"),
      },
      candy: {
        idle: getColorFromClass("bg-green-400"),
        mixed: getColorFromClass("bg-purple-500"),
        allocated: getColorFromClass("bg-red-600"),
        down: getColorFromClass("bg-pink-500"),
        drain: getColorFromClass("bg-pink-500"),
        unknown: getColorFromClass("bg-pink-500"),
      },
      desert: {
        idle: getColorFromClass("bg-amber-300"),
        mixed: getColorFromClass("bg-rose-800"),
        allocated: getColorFromClass("bg-purple-800"),
        down: getColorFromClass("bg-orange-600"),
        drain: getColorFromClass("bg-orange-600"),
        unknown: getColorFromClass("bg-orange-600"),
      },
      ocean: {
        idle: getColorFromClass("bg-cyan-400"),
        mixed: getColorFromClass("bg-blue-700"),
        allocated: getColorFromClass("bg-indigo-800"),
        down: getColorFromClass("bg-sky-600"),
        drain: getColorFromClass("bg-sky-600"),
        unknown: getColorFromClass("bg-sky-600"),
      },
    };

    return statusColorMap[colorSchema] || statusColorMap.default;
  }, [colorSchema]);

  // Calculate progress bar sections
  const progressSections = useMemo(() => {
    if (totalNodes === 0) return [];

    const sections = [
      {
        state: "idle",
        count: stats.nodeStates.idle,
        percentage: (stats.nodeStates.idle / totalNodes) * 100,
        color: getStatusColors.idle,
      },
      {
        state: "mixed",
        count: stats.nodeStates.mixed,
        percentage: (stats.nodeStates.mixed / totalNodes) * 100,
        color: getStatusColors.mixed,
      },
      {
        state: "allocated",
        count: stats.nodeStates.allocated,
        percentage: (stats.nodeStates.allocated / totalNodes) * 100,
        color: getStatusColors.allocated,
      },
      {
        state: "down",
        count: stats.nodeStates.down,
        percentage: (stats.nodeStates.down / totalNodes) * 100,
        color: getStatusColors.down,
      },
      {
        state: "drain",
        count: stats.nodeStates.drain,
        percentage: (stats.nodeStates.drain / totalNodes) * 100,
        color: getStatusColors.drain,
      },
      {
        state: "unknown",
        count: stats.nodeStates.unknown,
        percentage: (stats.nodeStates.unknown / totalNodes) * 100,
        color: getStatusColors.unknown,
      },
    ];

    // Filter out any states with 0 nodes
    return sections.filter((section) => section.count > 0);
  }, [stats, totalNodes, getStatusColors]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center space-x-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">System Activity</h3>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-lg font-semibold">{totalNodes}</div>
          <div className="text-sm text-muted-foreground">Total Nodes</div>
        </div>
      </CardHeader>
      <CardContent className="pb-1">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {/* Node state summary cards */}
          {["idle", "mixed", "allocated", "down", "drain", "unknown"].map(
            (stateKey) => {
              const count =
                stats.nodeStates[stateKey as keyof typeof stats.nodeStates];
              const percentage =
                totalNodes > 0 ? Math.round((count / totalNodes) * 100) : 0;

              return (
                <div
                  key={stateKey}
                  className="bg-secondary/30 rounded-md px-3 py-2 flex flex-col"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium capitalize">
                      {stateKey}
                    </div>
                    <div className="text-lg font-semibold">{count}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {percentage}% of nodes
                  </div>
                </div>
              );
            }
          )}
        </div>

        {/* Color-coded progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden flex mb-2">
          {progressSections.map((section, index) => (
            <div
              key={section.state}
              className={cn(
                "h-full transition-all duration-300",
                section.percentage < 3 && "min-w-[3%]" // Ensure tiny sections are still visible
              )}
              style={{
                width: `${Math.max(section.percentage, 0.5)}%`,
                backgroundColor: section.color,
              }}
              title={`${section.state}: ${
                section.count
              } nodes (${section.percentage.toFixed(1)}%)`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemActivityBanner;
