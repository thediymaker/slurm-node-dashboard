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

interface Reservation {
    name: string;
    start_time?: { number?: number };
    end_time?: { number?: number };
    node_count?: number;
    node_list?: string;
    users?: string;
    accounts?: string;
    flags?: string[];
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
};

function formatTimestamp(unixSeconds?: number): string {
    if (!unixSeconds || unixSeconds <= 0) return "—";
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getTimeRemaining(endTime?: number): string {
    if (!endTime) return "—";
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;

    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

export function ReservationsPanel() {
    const { data, isLoading, error } = useSWR("/api/slurm/reservations", fetcher, {
        refreshInterval: 15000,
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
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
                    <CardTitle className="text-xl font-medium">Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Failed to load reservation data
                    </p>
                </CardContent>
            </Card>
        );
    }

    const reservations: Reservation[] = data?.reservations ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl font-medium">Reservations</CardTitle>
            </CardHeader>
            <CardContent>
                {reservations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No active reservations
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Start</TableHead>
                                <TableHead>End</TableHead>
                                <TableHead>Time Left</TableHead>
                                <TableHead>Nodes</TableHead>
                                <TableHead>Users/Accounts</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reservations.map((reservation) => {
                                const isMaintenance = reservation.flags?.includes("MAINT");

                                return (
                                    <TableRow key={reservation.name}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {reservation.name}
                                                {isMaintenance && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        MAINT
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {formatTimestamp(reservation.start_time?.number)}
                                        </TableCell>
                                        <TableCell>
                                            {formatTimestamp(reservation.end_time?.number)}
                                        </TableCell>
                                        <TableCell>
                                            {getTimeRemaining(reservation.end_time?.number)}
                                        </TableCell>
                                        <TableCell>
                                            {reservation.node_count ?? reservation.node_list ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {reservation.users || reservation.accounts || "—"}
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
