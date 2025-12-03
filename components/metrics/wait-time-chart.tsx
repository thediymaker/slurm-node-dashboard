"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { TimeSeriesData } from "@/actions/metrics"

interface WaitTimeChartProps {
  data: TimeSeriesData[];
}

export function WaitTimeChart({ data }: WaitTimeChartProps) {
  const chartConfig = {
    value: {
      label: "Wait Time (min)",
      color: "hsl(var(--chart-3))",
    },
  } satisfies ChartConfig

  return (
    <Card className="col-span-2 h-full">
      <CardHeader>
        <CardTitle>Average Wait Time</CardTitle>
        <CardDescription>
          Daily average queue time in minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
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
            <YAxis />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="value"
              type="monotone"
              fill="var(--color-value)"
              fillOpacity={0.4}
              stroke="var(--color-value)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
