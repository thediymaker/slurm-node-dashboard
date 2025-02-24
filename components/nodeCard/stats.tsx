import React, { useMemo, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { Activity, Cpu, Database, Power, RefreshCw } from "lucide-react";
import { parseGPUResources } from "@/utils/gpu-parse";
import { cn } from "@/lib/utils";
import { CustomTooltip } from "./stats-power-tooltip";
import useSWR from "swr";

// SWR fetcher function
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch data");
  return res.json();
};

const Stats = memo(({ data }: { data: { nodes: any[] } }) => {
  const nodes = data?.nodes ?? [];

  const [isPrometheusAvailable, setIsPrometheusAvailable] = React.useState<
    boolean | null
  >(null);
  const shouldFetch = isPrometheusAvailable !== false;

  const {
    data: ipmiData,
    error,
    isValidating,
    mutate,
  } = useSWR(shouldFetch ? "/api/prometheus/ipmi" : null, fetcher, {
    fallbackData: { status: 404, data: [], summary: null },
    onError: (err) => {
      console.error("Prometheus endpoint error:", err);
      setIsPrometheusAvailable(false);
    },
    onSuccess: (data) => {
      setIsPrometheusAvailable(data.status === 200);
    },
  });

  const prometheusAvailable = isPrometheusAvailable === true;
  const prometheusData = ipmiData?.data || [];
  const powerSummary = ipmiData?.summary;

  // Compute aggregated stats using reduce for clarity
  const stats = useMemo(() => {
    const initialStats = {
      totalMemoryUsed: 0,
      totalMemory: 0,
      totalCoresUsed: 0,
      totalCores: 0,
      totalGpuUsed: 0,
      totalGpu: 0,
      totalPowerUsage: 0,
      totalPowerNodes: 0,
      totalGpuNodes: 0,
      nodeStates: {
        idle: 0,
        mixed: 0,
        allocated: 0,
        down: 0,
        drain: 0,
        unknown: 0,
      },
    };

    return nodes.reduce((acc, node) => {
      acc.totalMemoryUsed += node.alloc_memory;
      acc.totalMemory += node.real_memory;
      acc.totalCoresUsed += node.alloc_cpus;
      acc.totalCores += node.cpus;

      // Use Slurm power data only if Prometheus isn't available
      if (!prometheusAvailable && node.energy?.current_watts?.number) {
        acc.totalPowerUsage += node.energy.current_watts.number;
        acc.totalPowerNodes++;
      }

      if (node.gres) {
        const { gpuTotal, gpuUsed } = parseGPUResources(
          node.gres,
          node.gres_used
        );
        acc.totalGpuUsed += gpuUsed;
        acc.totalGpu += gpuTotal;
        acc.totalGpuNodes++;
      }

      const [primaryState, secondaryState] = node.state;
      if (primaryState === "IDLE") acc.nodeStates.idle++;
      if (primaryState === "MIXED") acc.nodeStates.mixed++;
      if (primaryState === "ALLOCATED") acc.nodeStates.allocated++;
      if (primaryState === "DOWN") acc.nodeStates.down++;
      if (secondaryState === "DRAIN") acc.nodeStates.drain++;
      if (primaryState === "UNKNOWN" || secondaryState === "NOT_RESPONDING")
        acc.nodeStates.unknown++;

      return acc;
    }, initialStats);
  }, [nodes, prometheusAvailable]);

  // Determine power totals and averages based on availability of Prometheus
  const currentTotal = prometheusAvailable
    ? powerSummary?.currentTotal || 0
    : stats.totalPowerUsage;
  const averagePower = prometheusAvailable
    ? powerSummary?.currentAverage || 0
    : stats.totalPowerNodes > 0
    ? stats.totalPowerUsage / stats.totalPowerNodes
    : 0;

  const hasPowerData =
    (prometheusAvailable && currentTotal > 0) ||
    (!prometheusAvailable && stats.totalPowerUsage > 0);

  const cpuPercentage =
    stats.totalCores > 0
      ? Math.round((stats.totalCoresUsed / stats.totalCores) * 100)
      : 0;
  const memoryPercentage =
    stats.totalMemory > 0
      ? Math.round((stats.totalMemoryUsed / stats.totalMemory) * 100)
      : 0;
  const gpuPercentage =
    stats.totalGpu > 0
      ? Math.round((stats.totalGpuUsed / stats.totalGpu) * 100)
      : 0;

  // Helper to normalize time values
  const normalizeTime = (time: string | number | Date): number => {
    if (typeof time === "number") {
      return time.toString().length === 13 ? time : time * 1000;
    }
    return new Date(time).getTime();
  };

  // Prepare data for the power usage trend chart
  const powerTrendData = useMemo(() => {
    if (prometheusAvailable && prometheusData.length > 0) {
      return prometheusData.map(
        (item: { time: string | number | Date; [key: string]: any }) => ({
          ...item,
          time: normalizeTime(item.time),
        })
      );
    }
    return nodes
      .filter((node) => node.energy?.current_watts?.number)
      .slice(0, 10)
      .map((node) => ({
        time: Date.now(),
        watts: node.energy.current_watts.number,
        averageWatts: node.energy.current_watts.number,
        nodesReporting: 1,
      }));
  }, [nodes, prometheusAvailable, prometheusData]);

  if (error) {
    console.error("Failed to fetch power data:", error);
  }

  const showPowerCard =
    isValidating || (hasPowerData && (currentTotal > 0 || averagePower > 0));

  // Compute grid columns based on the number of visible cards
  const visibleCards =
    3 + (stats.totalGpu > 0 ? 1 : 0) + (showPowerCard ? 1 : 0);
  const gridColumns = `grid-cols-${visibleCards}`;

  return (
    <div className={cn("grid gap-4 mb-4", gridColumns)}>
      {/* CPU Usage Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">CPU Allocation</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{cpuPercentage}%</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalCoresUsed} of {stats.totalCores} cores
          </p>
          <div className="mt-4 h-2 w-full bg-secondary">
            <div
              className="h-2 bg-primary"
              style={{ width: `${cpuPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* GPU Usage Card */}
      {stats.totalGpu > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              GPU Allocation
            </CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gpuPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalGpuUsed} of {stats.totalGpu} GPUs
            </p>
            <div className="mt-4 h-2 w-full bg-secondary">
              <div
                className="h-2 bg-primary"
                style={{ width: `${gpuPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.totalGpuNodes} nodes with GPUs
            </p>
          </CardContent>
        </Card>
      )}

      {/* Memory Usage Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Memory Allocation
          </CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{memoryPercentage}%</div>
          <p className="text-xs text-muted-foreground">
            {Math.round(stats.totalMemoryUsed / 1024)} of{" "}
            {Math.round(stats.totalMemory / 1024)} GB
          </p>
          <div className="mt-4 h-2 w-full bg-secondary">
            <div
              className="h-2 bg-primary"
              style={{ width: `${memoryPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Power Usage Card */}
      {showPowerCard && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Power Usage</CardTitle>
            <div className="flex items-center space-x-2">
              <Power className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() =>
                  mutate(undefined, {
                    optimisticData: ipmiData,
                    rollbackOnError: true,
                  })
                }
                disabled={isValidating}
                title="Refresh"
                className="focus:outline-none"
              >
                <RefreshCw
                  className={`h-4 w-4 text-muted-foreground ${
                    isValidating ? "animate-spin" : "cursor-pointer"
                  }`}
                />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold">
                  {(currentTotal / 1000).toFixed(1)} kW
                </div>
                <p className="text-xs text-muted-foreground">Total Power</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {Math.round(averagePower)} W
                </div>
                <p className="text-xs text-muted-foreground">Per Node Avg</p>
              </div>
            </div>
            <div className="h-[60px] mt-4 relative overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerTrendData}>
                  <YAxis domain={["auto", "auto"]} hide />
                  {prometheusAvailable && (
                    <Tooltip
                      content={CustomTooltip}
                      cursor={{ stroke: "hsl(var(--muted-foreground))" }}
                      position={{ x: 0, y: 0 }}
                      wrapperStyle={{ zIndex: 100 }}
                      allowEscapeViewBox={{ x: true, y: true }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="watts"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Activity Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">System Activity</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{nodes.length}</div>
          <p className="text-xs text-muted-foreground">Nodes</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="font-medium">Idle</div>
              <div className="text-muted-foreground">
                {stats.nodeStates.idle} nodes
              </div>
            </div>
            <div>
              <div className="font-medium">Mixed</div>
              <div className="text-muted-foreground">
                {stats.nodeStates.mixed} nodes
              </div>
            </div>
            <div>
              <div className="font-medium">Allocated</div>
              <div className="text-muted-foreground">
                {stats.nodeStates.allocated} nodes
              </div>
            </div>
            <div>
              <div className="font-medium">Down</div>
              <div className="text-muted-foreground">
                {stats.nodeStates.down} nodes
              </div>
            </div>
            <div>
              <div className="font-medium">Drain</div>
              <div className="text-muted-foreground">
                {stats.nodeStates.drain} nodes
              </div>
            </div>
            <div>
              <div className="font-medium">Unknown</div>
              <div className="text-muted-foreground">
                {stats.nodeStates.unknown} nodes
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default Stats;
