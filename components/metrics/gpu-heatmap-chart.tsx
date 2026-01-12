"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"


interface GpuHeatmapData {
    day: number;
    hour: number;
    value: number;
    jobs: number;
}

interface GpuHeatmapChartProps {
    data: GpuHeatmapData[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function GpuHeatmapChart({ data }: GpuHeatmapChartProps) {
    // Find max value for color scaling
    const maxValue = Math.max(...data.map(d => d.value));



    if (!data || data.length === 0 || maxValue === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>GPU Usage Heatmap</CardTitle>
                    <CardDescription>
                        Intensity of GPU usage by day and hour
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                    No GPU usage data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle>GPU Usage Heatmap</CardTitle>
                <CardDescription>
                    Intensity of GPU usage by day and hour
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col p-4">
                <div className="flex flex-col flex-1 w-full gap-1">
                    <div className="flex mb-1">
                        <div className="w-8 shrink-0"></div>
                        {HOURS.map(h => (
                            <div key={h} className="flex-1 text-[10px] text-center text-muted-foreground">
                                {h % 3 === 0 ? h : ''}
                            </div>
                        ))}
                    </div>
                    {DAYS.map((day, dIdx) => (
                        <div key={day} className="flex flex-1 gap-1 min-h-0">
                            <div className="w-8 shrink-0 text-xs font-medium text-muted-foreground flex items-center justify-end pr-2">
                                {day}
                            </div>
                            {HOURS.map(h => {
                                const cell = data.find(d => d.day === dIdx && d.hour === h);
                                const value = cell?.value || 0;
                                const jobs = cell?.jobs || 0;
                                // Calculate opacity: min 0.1 for visibility if value > 0, up to 1.0
                                const opacity = value > 0 ? Math.max(0.15, value / maxValue) : 0.05;

                                return (
                                    <div
                                        key={h}
                                        className="flex-1 rounded-sm transition-opacity hover:opacity-100 relative group"
                                        style={{
                                            backgroundColor: value > 0 ? `hsl(var(--chart-1))` : 'hsl(var(--muted))',
                                            opacity: value > 0 ? opacity : 0.2
                                        }}
                                    >
                                        <div className="absolute inset-x-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                                            <div className="bg-popover text-popover-foreground text-xs p-2 rounded shadow-md whitespace-nowrap border">
                                                <div className="font-bold">{day} {h}:00</div>
                                                <div>{value.toFixed(1)} GPU Hours</div>
                                                <div>{jobs} Jobs</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-4 px-8 items-center">
                    <span>Low Usage</span>
                    <div className="flex h-3 w-32 rounded bg-muted overflow-hidden">
                        <div className="w-full h-full bg-[hsl(var(--chart-1))] opacity-20"></div>
                        <div className="w-full h-full bg-[hsl(var(--chart-1))] opacity-40"></div>
                        <div className="w-full h-full bg-[hsl(var(--chart-1))] opacity-60"></div>
                        <div className="w-full h-full bg-[hsl(var(--chart-1))] opacity-80"></div>
                        <div className="w-full h-full bg-[hsl(var(--chart-1))] opacity-100"></div>
                    </div>
                    <span>High Usage</span>
                </div>
            </CardContent>
        </Card>
    )
}
