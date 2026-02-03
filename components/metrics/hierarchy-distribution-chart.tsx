"use client"

import * as React from "react"
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GroupData } from "@/actions/metrics"
import { getHierarchyLabels } from "@/lib/utils"

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

  const { level1, level2 } = getHierarchyLabels();
  const title = level === 'college' ? `Usage by ${level1}` : `Usage by ${level2}`;
  const description = metric === 'coreHours' 
    ? `Distribution of core hours by ${level === 'college' ? level1 : level2}` 
    : `Distribution of jobs by ${level === 'college' ? level1 : level2}`;

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <ChartContainer config={chartConfig} className="flex-1 min-h-0 w-full [&_.recharts-pie-label-text]:fill-foreground">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
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
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value} />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
