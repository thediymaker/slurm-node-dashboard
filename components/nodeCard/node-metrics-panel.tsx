"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Cpu, Thermometer, MemoryStick, Activity, Gauge, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricData {
  time: Date | string;
  value: number | string;
}

interface NodeMetricsPanelProps {
  data: {
    status: number;
    data?: MetricData[];
    message?: string;
  } | null;
  metricName: string;
  isLoading?: boolean;
  // Metric and range pickers, shown at the right of the header
  controls?: React.ReactNode;
  // Extra summary next to the title
  aside?: React.ReactNode;
}

const formatValue = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 1 });

// Map metric names to display info
const metricDisplayInfo: Record<string, { 
  label: string; 
  unit: string; 
  icon: React.ElementType;
  color: string;
  description: string;
}> = {
  node_load5: { 
    label: "5m Load Avg", 
    unit: "", 
    icon: Activity,
    color: "hsl(var(--chart-1))",
    description: "5-minute load average"
  },
  node_load15: { 
    label: "15m Load Avg", 
    unit: "", 
    icon: Activity,
    color: "hsl(var(--chart-1))",
    description: "15-minute load average"
  },
  node_procs_running: { 
    label: "Running Procs", 
    unit: "", 
    icon: Cpu,
    color: "hsl(var(--chart-2))",
    description: "Processes currently running"
  },
  node_procs_blocked: { 
    label: "Blocked Procs", 
    unit: "", 
    icon: Cpu,
    color: "hsl(var(--chart-5))",
    description: "Processes blocked on I/O"
  },
  node_memory_Active_bytes: { 
    label: "Active Memory", 
    unit: "GB", 
    icon: MemoryStick,
    color: "hsl(var(--chart-3))",
    description: "Memory actively in use"
  },
  node_memory_MemAvailable_bytes: { 
    label: "Available Memory", 
    unit: "GB", 
    icon: MemoryStick,
    color: "hsl(var(--chart-3))",
    description: "Memory available for allocation"
  },
  node_memory_SwapFree_bytes: { 
    label: "Swap Free", 
    unit: "GB", 
    icon: MemoryStick,
    color: "hsl(var(--chart-4))",
    description: "Swap space available"
  },
  node_vmstat_oom_kill: { 
    label: "OOM Kills", 
    unit: "", 
    icon: Activity,
    color: "hsl(var(--destructive))",
    description: "Out-of-memory kill events"
  },
  node_network_receive_bytes_total: { 
    label: "Network RX", 
    unit: "MB/s", 
    icon: Activity,
    color: "hsl(var(--chart-2))",
    description: "Network receive throughput"
  },
  node_network_transmit_bytes_total: { 
    label: "Network TX", 
    unit: "MB/s", 
    icon: Activity,
    color: "hsl(var(--chart-4))",
    description: "Network transmit throughput"
  },
  node_hwmon_temp_celsius: { 
    label: "CPU Temp", 
    unit: "°F", 
    icon: Thermometer,
    color: "hsl(var(--chart-5))",
    description: "CPU package temperature"
  },
  DCGM_FI_DEV_GPU_TEMP: { 
    label: "GPU Temp", 
    unit: "°F", 
    icon: Thermometer,
    color: "hsl(var(--chart-5))",
    description: "GPU temperature"
  },
  DCGM_FI_DEV_GPU_UTIL: { 
    label: "GPU Util", 
    unit: "%", 
    icon: Gauge,
    color: "hsl(var(--chart-1))",
    description: "GPU utilization percentage"
  },
  DCGM_FI_DEV_MEM_COPY_UTIL: { 
    label: "GPU Mem Util", 
    unit: "%", 
    icon: Gauge,
    color: "hsl(var(--chart-3))",
    description: "GPU memory utilization"
  },
  DCGM_FI_DEV_FB_USED: { 
    label: "GPU Memory", 
    unit: "GB", 
    icon: MemoryStick,
    color: "hsl(var(--chart-3))",
    description: "GPU framebuffer memory used"
  },
  DCGM_FI_DEV_POWER_USAGE: { 
    label: "GPU Power", 
    unit: "W", 
    icon: Zap,
    color: "hsl(var(--chart-4))",
    description: "GPU power consumption"
  },
};

export function NodeMetricsPanel({ data, metricName, isLoading, controls, aside }: NodeMetricsPanelProps) {
  const displayInfo = metricDisplayInfo[metricName] || {
    label: metricName,
    unit: "",
    icon: Activity,
    color: "hsl(var(--chart-1))",
    description: "Metric value over time"
  };

  // Process chart data
  const { chartData, stats, hasData } = useMemo(() => {
    if (!data || data.status === 404 || !data.data || data.data.length === 0) {
      return { chartData: [], stats: null, hasData: false };
    }

    const values = data.data
      .map((d) => parseFloat(String(d.value)))
      .filter((v) => !isNaN(v));

    if (values.length === 0) {
      return { chartData: [], stats: null, hasData: false };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const current = values[values.length - 1];

    // Format chart data with proper time formatting
    const formatted = data.data.map((d) => ({
      time: new Date(d.time).toLocaleString(undefined, { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      value: parseFloat(String(d.value)) || 0,
    }));

    return {
      chartData: formatted,
      stats: { min, max, avg, current },
      hasData: true,
    };
  }, [data]);

  const chartConfig = {
    value: {
      label: displayInfo.label,
      color: displayInfo.color,
    },
  } satisfies ChartConfig;

  const unit = displayInfo.unit ? ` ${displayInfo.unit}` : "";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold">{displayInfo.label}</h3>
        {isLoading ? (
          <Skeleton className="h-3.5 w-36 self-center" />
        ) : stats ? (
          <span className="text-xs text-muted-foreground tabular-nums" title={displayInfo.description}>
            now {formatValue(stats.current)}{unit} · avg {formatValue(stats.avg)} · min {formatValue(stats.min)} · peak {formatValue(stats.max)}
          </span>
        ) : null}
        <div className="flex-1" />
        {aside}
      </div>
      {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}

      {isLoading ? (
        <Skeleton className="h-[170px] w-full" />
      ) : !hasData ? (
        <div className="flex h-[170px] flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
          <displayInfo.icon className="h-5 w-5" />
          {data?.message || "No data available for this metric on this node"}
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[170px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                // Show shorter format for x-axis
                const parts = value.split(', ');
                return parts[0] || value;
              }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={45}
              tickFormatter={(value) => 
                value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)
              }
            />
            <ChartTooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="value"
              type="monotone"
              fill="url(#fillValue)"
              stroke="var(--color-value)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </Card>
  );
}
