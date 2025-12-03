"use client"

import * as React from "react"
import { PieChart, Pie, Cell, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { JobStateData } from "@/actions/metrics"

const STATE_COLORS: Record<string, string> = {
  COMPLETED: "hsl(var(--chart-2))", // Green-ish
  FAILED: "hsl(var(--chart-1))",    // Red-ish
  TIMEOUT: "hsl(var(--chart-3))",   // Orange-ish
  CANCELLED: "hsl(var(--chart-4))", // Yellow-ish
  NODE_FAIL: "hsl(var(--chart-5))", // Purple-ish
  PREEMPTED: "hsl(var(--chart-3))",
  BOOT_FAIL: "hsl(var(--chart-1))",
  DEADLINE: "hsl(var(--chart-1))",
  OUT_OF_MEMORY: "hsl(var(--chart-1))",
};

const DEFAULT_COLOR = "hsl(var(--muted))";

interface JobStateChartProps {
  data: JobStateData[];
}

export function JobStateChart({ data }: JobStateChartProps) {
  const chartConfig: ChartConfig = {
    count: {
      label: "Jobs",
    },
    ...data.reduce((acc, item) => ({
      ...acc,
      [item.state]: {
        label: item.state,
        color: STATE_COLORS[item.state.toUpperCase()] || DEFAULT_COLOR,
      }
    }), {})
  }

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>Job Outcome</CardTitle>
        <CardDescription>Distribution of job states</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto max-h-[350px] pb-0">
          <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
            <Pie
              data={data}
              dataKey="count"
              nameKey="state"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              label={({ state, percent }) => `${state} ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={STATE_COLORS[entry.state.toUpperCase()] || DEFAULT_COLOR} 
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
