"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GroupData } from "@/actions/metrics"

interface PartitionChartProps {
  data: GroupData[];
  metric: 'coreHours' | 'jobCount';
}

export function PartitionChart({ data, metric }: PartitionChartProps) {
  const chartConfig = {
    value: {
      label: metric === 'coreHours' ? "Core Hours" : "Job Count",
      color: "hsl(var(--chart-4))",
    },
  } satisfies ChartConfig

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>Partition Usage</CardTitle>
        <CardDescription>
          {metric === 'coreHours' 
            ? "Resource consumption by partition" 
            : "Job submission count by partition"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
