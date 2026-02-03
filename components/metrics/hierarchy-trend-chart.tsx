"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { getHierarchyLabels } from "@/lib/utils"

interface HierarchyTrendChartProps {
  data: any[];
  entities: string[];
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

export function HierarchyTrendChart({ data, entities, metric, level }: HierarchyTrendChartProps) {
  const chartConfig = {
    value: {
      label: metric === 'coreHours' ? "Core Hours" : "Job Count",
    },
  } satisfies ChartConfig

  const { level1, level2 } = getHierarchyLabels();
  const title = level === 'college' ? `${level1} Usage Trends` : `${level2} Usage Trends`;
  const description = "Usage over time";

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(5)}
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            {entities.map((entity, index) => (
                <Area
                    key={entity}
                    dataKey={entity}
                    type="monotone"
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.4}
                    stroke={COLORS[index % COLORS.length]}
                    stackId="a"
                />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
