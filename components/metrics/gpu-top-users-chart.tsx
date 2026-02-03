"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface GpuUserData {
    name: string;
    value: number;
    jobCount: number;
}

interface GpuTopUsersChartProps {
    data: GpuUserData[];
}

const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

export function GpuTopUsersChart({ data }: GpuTopUsersChartProps) {
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
                    <CardTitle>Top GPU Users</CardTitle>
                    <CardDescription>
                        Users with highest GPU hours consumed
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                    No GPU user data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Top GPU Users</CardTitle>
                <CardDescription>
                    Users with highest GPU hours consumed
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
                            width={80}
                            tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                        />
                        <ChartTooltip
                            content={<ChartTooltipContent />}
                            formatter={(value: any, name: any, props: any) => [
                                `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} GPU Hours (${props.payload.jobCount} jobs)`,
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
