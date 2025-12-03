"use client"

import * as React from "react"
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { GroupData } from "@/actions/metrics"

interface TopUsersChartProps {
  data: GroupData[];
  metric: 'coreHours' | 'jobCount';
}

export function TopUsersChart({ data, metric }: TopUsersChartProps) {
  const chartConfig = {
    value: {
      label: metric === 'coreHours' ? "Core Hours" : "Job Count",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  return (
    <Card className="col-span-1 h-full">
      <CardHeader>
        <CardTitle>Top Users</CardTitle>
        <CardDescription>
          {metric === 'coreHours' 
            ? "Highest consumers by core hours" 
            : "Most active users by job count"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{
              left: 20, // Adjust for long usernames
            }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={100}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
