"use client"

import * as React from "react"
import { PieChart, Pie, Cell, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GroupData } from "@/actions/metrics"

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface UsagePieChartProps {
  data: GroupData[];
  metric: 'coreHours' | 'jobCount';
}

export function UsagePieChart({ data, metric }: UsagePieChartProps) {
  // Generate dynamic config based on data keys
  const chartConfig: ChartConfig = {
    value: {
      label: metric === 'coreHours' ? "Core Hours" : "Job Count",
    },
    ...data.reduce((acc, item, index) => ({
      ...acc,
      [item.name]: {
        label: item.name,
        color: COLORS[index % COLORS.length],
      }
    }), {})
  }

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>Top Usage by Group</CardTitle>
        <CardDescription>
          {metric === 'coreHours' 
            ? "Top consumers by core hours" 
            : "Top consumers by job count"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto max-h-[350px] pb-0">
          <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={5}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
