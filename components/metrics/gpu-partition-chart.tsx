"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface GpuPartitionData {
    name: string;
    value: number;
    jobCount: number;
}

interface GpuPartitionChartProps {
    data: GpuPartitionData[];
}

const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

export function GpuPartitionChart({ data }: GpuPartitionChartProps) {
    const chartConfig = {
        value: {
            label: "GPU Hours",
            color: "hsl(var(--chart-3))",
        },
    } satisfies ChartConfig

    if (!data || data.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>GPU Hours by Partition</CardTitle>
                    <CardDescription>
                        GPU usage distribution across partitions
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                    No GPU partition data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>GPU Hours by Partition</CardTitle>
                <CardDescription>
                    GPU usage distribution across partitions
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart accessibilityLayer data={data} layout="vertical">
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" />
                        <YAxis
                            dataKey="name"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            width={100}
                        />
                        <ChartTooltip
                            content={<ChartTooltipContent />}
                            formatter={(value: any, name: any, props: any) => [
                                `${value.toLocaleString()} GPU Hours (${props.payload.jobCount} jobs)`,
                                name
                            ]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
