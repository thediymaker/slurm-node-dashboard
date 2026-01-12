"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, ComposedChart, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface GpuTimeSeriesData {
    date: string;
    gpuHours: number;
    gpuJobs: number;
}

interface GpuTimeSeriesChartProps {
    data: GpuTimeSeriesData[];
}

export function GpuTimeSeriesChart({ data }: GpuTimeSeriesChartProps) {
    const chartConfig = {
        gpuHours: {
            label: "GPU Hours",
            color: "hsl(var(--chart-3))",
        },
        gpuJobs: {
            label: "GPU Jobs",
            color: "hsl(var(--chart-4))",
        },
    } satisfies ChartConfig

    if (!data || data.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>GPU Usage Over Time</CardTitle>
                    <CardDescription>
                        GPU hours consumed and number of GPU jobs per day
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                    No GPU data available for the selected period
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>GPU Usage Over Time</CardTitle>
                <CardDescription>
                    GPU hours consumed and number of GPU jobs per day
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <ComposedChart accessibilityLayer data={data}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value.slice(5)} // Show MM-DD
                        />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="gpuHours" fill="var(--color-gpuHours)" radius={[4, 4, 0, 0]} name="GPU Hours" />
                        <Line yAxisId="right" type="monotone" dataKey="gpuJobs" stroke="var(--color-gpuJobs)" strokeWidth={2} dot={false} name="GPU Jobs" />
                    </ComposedChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
