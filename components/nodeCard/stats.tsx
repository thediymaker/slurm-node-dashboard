import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { Activity, Cpu, Database, Power } from "lucide-react";
import { parseGPUResources } from "@/utils/gpu-parse";
import { cn } from "@/lib/utils";
import { CustomTooltip } from "./stats-power-tooltip";
import useSWR from "swr";

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch data");
  return res.json();
};

export default function Stats({ data }: { data: { nodes: any[] } }) {
  const systems = data?.nodes || [];
  const [isPrometheusAvailable, setIsPrometheusAvailable] = React.useState<
    boolean | null
  >(null);
  const shouldFetch = isPrometheusAvailable !== false;
  const { data: powerData, error } = useSWR(
    shouldFetch ? "/api/prometheus/ipmi" : null,
    fetcher,
    {
      refreshInterval: 60000, // 60 seconds
      fallbackData: { status: 404, data: [], summary: null },
      onError: (err) => {
        console.error("Prometheus endpoint error:", err);
        setIsPrometheusAvailable(false);
      },
      onSuccess: (data) => {
        setIsPrometheusAvailable(data.status === 200);
      },
    }
  );

  const usePrometheusData = powerData?.status === 200;
  const prometheusData = powerData?.data || [];
  const powerSummary = powerData?.summary;

  const stats = React.useMemo(() => {
    let totalMemoryUsed = 0;
    let totalMemory = 0;
    let totalCoresUsed = 0;
    let totalCores = 0;
    let totalGpuUsed = 0;
    let totalGpu = 0;
    let totalPowerUsage = 0;
    let totalPowerNodes = 0;
    let totalGpuNodes = 0;
    let nodeStates = {
      idle: 0,
      mixed: 0,
      allocated: 0,
      down: 0,
      drain: 0,
      unknown: 0,
    };

    systems.forEach((node) => {
      totalMemoryUsed += node.alloc_memory;
      totalMemory += node.real_memory;
      totalCoresUsed += node.alloc_cpus;
      totalCores += node.cpus;

      // Only use Slurm power data if Prometheus data isn't available
      if (!usePrometheusData && node.energy?.current_watts?.number) {
        totalPowerUsage += node.energy.current_watts.number;
        totalPowerNodes++;
      }

      if (node.gres) {
        const { gpuTotal, gpuUsed } = parseGPUResources(
          node.gres,
          node.gres_used
        );
        totalGpuUsed += gpuUsed;
        totalGpu += gpuTotal;
        totalGpuNodes++;
      }

      if (node.state[0] === "IDLE") nodeStates.idle++;
      if (node.state[0] === "MIXED") nodeStates.mixed++;
      if (node.state[0] === "ALLOCATED") nodeStates.allocated++;
      if (node.state[0] === "DOWN") nodeStates.down++;
      if (node.state[0] === "UNKNOWN" || node.state[1] === "NOT_RESPONDING")
        nodeStates.unknown++;
      if (node.state[1] === "DRAIN") nodeStates.drain++;
    });

    return {
      totalMemoryUsed,
      totalMemory,
      totalCoresUsed,
      totalCores,
      totalGpuUsed,
      totalGpu,
      averagePowerUsage: usePrometheusData
        ? powerSummary?.currentAverage || 0
        : totalPowerNodes > 0
        ? totalPowerUsage / totalPowerNodes
        : 0,
      totalPowerKw: usePrometheusData
        ? (powerSummary?.currentTotal || 0) / 1000
        : totalPowerUsage / 1000,
      nodeStates,
      totalGpuNodes,
      hasPowerData: usePrometheusData ? true : totalPowerNodes > 0,
    };
  }, [systems, usePrometheusData, powerSummary]);

  // Use Prometheus data for the chart if available, otherwise fallback to Slurm data
  const powerTrendData = React.useMemo(() => {
    if (usePrometheusData && prometheusData.length > 0) {
      return prometheusData.map((data: { time: string | number | Date }) => ({
        ...data,
        time:
          typeof data.time === "number"
            ? data.time.toString().length === 13
              ? data.time
              : data.time * 1000
            : new Date(data.time).getTime(),
      }));
    }

    return systems.slice(0, 10).map((node) => ({
      time: Date.now(),
      watts: node.energy?.current_watts?.number || 0,
      averageWatts: node.energy?.current_watts?.number || 0,
      nodesReporting: 1,
    }));
  }, [systems, usePrometheusData, prometheusData]);

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

  if (error) {
    console.error("Failed to fetch power data:", error);
  }

  return (
    <div
      className={cn(
        "grid gap-4 mb-4",
        stats.hasPowerData ? "grid-cols-5" : "grid-cols-4"
      )}
    >
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
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
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
      {stats.hasPowerData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Power Usage</CardTitle>
            <Power className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold">
                  {stats.totalPowerKw.toFixed(1)} kW
                </div>
                <p className="text-xs text-muted-foreground">Total Power</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {Math.round(stats.averagePowerUsage)} W
                </div>
                <p className="text-xs text-muted-foreground">Per Node Avg</p>
              </div>
            </div>
            <div className="h-[60px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerTrendData}>
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip content={CustomTooltip} />
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
          <div className="text-2xl font-bold">{systems.length}</div>
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
}
