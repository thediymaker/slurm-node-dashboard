"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GroupData } from "@/actions/metrics"

interface JobDurationChartProps {
  data: GroupData[];
}

export function JobDurationChart({ data }: JobDurationChartProps) {
  const chartConfig = {
    value: {
      label: "Jobs",
      color: "hsl(var(--chart-5))",
    },
  } satisfies ChartConfig

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>Job Duration</CardTitle>
        <CardDescription>Distribution of job runtimes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
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
