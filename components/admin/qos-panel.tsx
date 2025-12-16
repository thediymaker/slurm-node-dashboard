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
import { Skeleton } from "@/components/ui/skeleton";
import useSWR from "swr";

interface SlurmValue {
    set?: boolean;
    infinite?: boolean;
    number?: number;
}

interface QoS {
    name: string;
    description?: string;
    priority?: SlurmValue;
    limits?: {
        max?: {
            jobs?: { per?: { user?: SlurmValue } };
            wall_clock?: { per?: { qos?: SlurmValue } };
            tres?: { per?: { user?: any[] } };
        };
    };
    preempt?: { mode?: string[] };
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
};

// Helper to extract value from Slurm's {set, infinite, number} format
function extractValue(val: SlurmValue | number | undefined): string {
    if (val === undefined || val === null) return "—";
    if (typeof val === "number") return val.toLocaleString();
    if (val.infinite) return "Unlimited";
    if (val.number !== undefined && val.number >= 0) return val.number.toLocaleString();
    return "—";
}

function formatWallTime(val: SlurmValue | number | undefined): string {
    if (val === undefined || val === null) return "—";

    let seconds: number;
    if (typeof val === "number") {
        seconds = val;
    } else {
        if (val.infinite) return "Unlimited";
        if (val.number === undefined || val.number <= 0) return "—";
        seconds = val.number;
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) return `${days} days`;
    if (hours > 0) return `${hours} hours`;
    return `${Math.floor(seconds / 60)} min`;
}

export function QoSPanel() {
    const { data, isLoading, error } = useSWR("/api/slurm/qos", fetcher, {
        refreshInterval: 15000,
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Quality of Service</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
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
                    <CardTitle className="text-xl font-medium">Quality of Service</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Failed to load QoS data
                    </p>
                </CardContent>
            </Card>
        );
    }

    const qosList: QoS[] = data?.qos ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl font-medium">Quality of Service</CardTitle>
            </CardHeader>
            <CardContent>
                {qosList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No QoS entries found</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Max Jobs/User</TableHead>
                                <TableHead>Max Wall Time</TableHead>
                                <TableHead>Preempt Mode</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {qosList.map((qos) => (
                                <TableRow key={qos.name}>
                                    <TableCell className="font-medium">{qos.name}</TableCell>
                                    <TableCell>
                                        {extractValue(qos.priority)}
                                    </TableCell>
                                    <TableCell>
                                        {extractValue(qos.limits?.max?.jobs?.per?.user)}
                                    </TableCell>
                                    <TableCell>
                                        {formatWallTime(qos.limits?.max?.wall_clock?.per?.qos)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {qos.preempt?.mode?.join(", ") || "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
