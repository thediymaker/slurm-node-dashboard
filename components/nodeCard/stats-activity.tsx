import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getColorSchema } from "@/lib/color-schemas";

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

  // Get the color schema for the current selection
  const schema = getColorSchema(colorSchema);

  // Calculate progress sections
  const progressSections: {
    state: "idle" | "mixed" | "allocated" | "down" | "drain" | "unknown";
    count: number;
    percentage: number;
    color: string;
  }[] = [];

  if (totalNodes > 0) {
    const states = [
      "idle",
      "mixed",
      "allocated",
      "down",
      "drain",
      "unknown",
    ] as const;

    states.forEach((state) => {
      const count = stats.nodeStates[state];
      if (count > 0) {
        progressSections.push({
          state,
          count,
          percentage: (count / totalNodes) * 100,
          color: schema.progressColors[state],
        });
      }
    });
  }

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
          {(
            ["idle", "mixed", "allocated", "down", "drain", "unknown"] as const
          ).map((stateKey) => {
            const count = stats.nodeStates[stateKey];
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
          })}
        </div>

        {/* Color-coded progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden flex mb-2">
          {progressSections.map((section) => (
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
