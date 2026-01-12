"use client"

import * as React from "react"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface GpuScatterData {
    jobId: string;
    user: string;
    gpuCount: number;
    duration: number;
}

interface GpuScatterChartProps {
    data: GpuScatterData[];
}

export function GpuScatterChart({ data }: GpuScatterChartProps) {
    const chartConfig = {
        value: {
            label: "Job",
            color: "hsl(var(--chart-1))",
        },
    } satisfies ChartConfig

    if (!data || data.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>GPU Job Efficiency</CardTitle>
                    <CardDescription>
                        Job Duration vs GPU Count
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                    No GPU job data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Job Duration vs GPU Count</CardTitle>
                <CardDescription>
                    Compare job runtimes against GPU allocation size
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid />
                        <XAxis
                            type="number"
                            dataKey="duration"
                            name="Duration"
                            unit="h"
                            label={{ value: 'Job Duration (Hours)', position: 'bottom', offset: 0 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="gpuCount"
                            name="GPUs"
                            label={{ value: 'GPU Count', angle: -90, position: 'left' }}
                        />
                        <ZAxis
                            type="number"
                            dataKey="gpuCount"
                            range={[60, 400]}
                            name="GPU Hours"
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs">
                                            <div className="font-bold mb-1">Job {data.jobId}</div>
                                            <div>User: {data.user}</div>
                                            <div>GPUs: {data.gpuCount}</div>
                                            <div>Duration: {data.duration.toFixed(2)}h</div>
                                            <div>Total: {(data.duration * data.gpuCount).toFixed(2)} GPU Hours</div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Scatter
                            name="Jobs"
                            data={data}
                            fill="hsl(var(--chart-1))"
                            fillOpacity={0.6}
                        />
                    </ScatterChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
