"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import useSWR from "swr";

interface Partition {
    name: string;
    state: { current: string[] } | string[];
    nodes: { total: number; configured?: string };
    cpus: { total: number };
    maximums?: { time?: { number?: number; infinite?: boolean } };
    defaults?: { time?: { number?: number } };
    partition?: { default?: boolean };
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
};

function formatTime(seconds?: number, infinite?: boolean): string {
    if (infinite) return "Unlimited";
    if (!seconds || seconds <= 0) return "—";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

export function PartitionsPanel() {
    const { data, isLoading, error } = useSWR("/api/slurm/partitions", fetcher, {
        refreshInterval: 15000,
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Partitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Partitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Failed to load partition data
                    </p>
                </CardContent>
            </Card>
        );
    }

    const partitions: Partition[] = data?.partitions ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl font-medium">Partitions</CardTitle>
            </CardHeader>
            <CardContent>
                {partitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No partitions found</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>State</TableHead>
                                <TableHead>Nodes</TableHead>
                                <TableHead>CPUs</TableHead>
                                <TableHead>Max Time</TableHead>
                                <TableHead>Default</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {partitions.map((partition) => {
                                const state = Array.isArray(partition.state)
                                    ? partition.state[0]
                                    : partition.state?.current?.[0] ?? "UNKNOWN";
                                const isUp = state === "UP";
                                const isDefault = partition.partition?.default ?? false;

                                return (
                                    <TableRow key={partition.name}>
                                        <TableCell className="font-medium">
                                            {partition.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isUp ? "default" : "secondary"}>
                                                {state}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{partition.nodes?.total ?? "—"}</TableCell>
                                        <TableCell>{partition.cpus?.total?.toLocaleString() ?? "—"}</TableCell>
                                        <TableCell>
                                            {formatTime(
                                                partition.maximums?.time?.number,
                                                partition.maximums?.time?.infinite
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isDefault ? (
                                                <Badge variant="outline">Default</Badge>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
