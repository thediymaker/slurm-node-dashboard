"use client"

import * as React from "react"
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GroupData } from "@/actions/metrics"

interface HierarchyDistributionChartProps {
  data: GroupData[];
  metric: 'coreHours' | 'jobCount';
  level: 'college' | 'department';
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function HierarchyDistributionChart({ data, metric, level }: HierarchyDistributionChartProps) {
  const chartConfig = {
    value: {
      label: metric === 'coreHours' ? "Core Hours" : "Job Count",
    },
  } satisfies ChartConfig

  const title = level === 'college' ? "Usage by College" : "Usage by Department";
  const description = metric === 'coreHours' 
    ? `Distribution of core hours by ${level}` 
    : `Distribution of jobs by ${level}`;

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value} />} />
          </PieChart>
        </ChartContainer>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            {data.slice(0, 5).map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span>{entry.name}</span>
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
