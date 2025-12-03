"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TimeSeriesData } from "@/actions/metrics"

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  metric: 'coreHours' | 'jobCount';
}

export function TimeSeriesChart({ data, metric }: TimeSeriesChartProps) {
  const chartConfig = {
    value: {
      label: metric === 'coreHours' ? "Core Hours" : "Job Count",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig

  return (
    <Card className="col-span-2 h-full">
      <CardHeader>
        <CardTitle>{metric === 'coreHours' ? "Core Hours" : "Job Count"} Over Time</CardTitle>
        <CardDescription>
          {metric === 'coreHours' 
            ? "Total CPU hours consumed per day" 
            : "Total number of jobs completed per day"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(5)} // Show MM-DD
            />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill={`var(--color-value)`} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
