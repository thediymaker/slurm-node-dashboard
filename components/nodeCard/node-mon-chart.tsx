"use client";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useMemo } from "react";

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-2))",
  },
  time: {
    label: "Time",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export const NodeCpuChart = ({ data }: any) => {
  // Handle missing data, errors, or 404 status
  if (!data || data.status === 404 || !data.data || data.data.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg font-light">System Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground">
          No data available for this metric
        </CardContent>
      </Card>
    );
  }

  // Analyze the data to determine if it's essentially flat/constant
  const { isFlat, currentValue, minValue, maxValue, avgValue } = useMemo(() => {
    const values = data.data
      .map((d: any) => parseFloat(d.value))
      .filter((v: number) => !isNaN(v));
    
    if (values.length === 0) {
      return { isFlat: true, currentValue: 0, minValue: 0, maxValue: 0, avgValue: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const current = values[values.length - 1];
    
    // Consider it "flat" if the range is very small relative to the average
    // or if all values are essentially the same (within 1% or absolute 0.1)
    const range = max - min;
    const threshold = Math.max(avg * 0.05, 0.1); // 5% of average or 0.1, whichever is larger
    const flat = range < threshold;

    return { 
      isFlat: flat, 
      currentValue: current, 
      minValue: min, 
      maxValue: max, 
      avgValue: avg 
    };
  }, [data.data]);

  // For flat data, show a stat card instead of an invisible line
  if (isFlat) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg font-light">System Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px]">
          <div className="text-5xl font-bold text-primary tabular-nums">
            {typeof currentValue === 'number' ? currentValue.toLocaleString(undefined, { 
              minimumFractionDigits: 0, 
              maximumFractionDigits: 2 
            }) : currentValue}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Current value (constant over period)
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg font-light">System Metrics</CardTitle>
      </CardHeader>
      <CardContent className="">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart
            accessibilityLayer
            data={data.data}
            margin={{
              left: 12,
              right: 12,
            }}
            width={730}
            height={250}
          >
            <YAxis type="number" domain={['auto', 'auto']} width={40} scale="linear" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="value"
              type="monotone"
              stroke="#8884d8"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
