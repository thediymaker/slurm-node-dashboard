"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Server } from "lucide-react";
import { convertUnixToHumanReadable } from "@/utils/nodes";

interface ReservationInfo {
    name: string;
    accounts: string;
    users: string;
    start_time: { number: number };
    end_time: { number: number };
    duration: { number: number };
    nodes: string;
    node_cnt: number | { number: number };
    core_cnt: number | { number: number };
    features: string;
    partition: string;
    flags: string[];
}

interface SlurmReservationListProps {
    reservations: ReservationInfo[];
}

export function SlurmReservationList({ reservations }: SlurmReservationListProps) {
    
    if (!Array.isArray(reservations) || reservations.length === 0) {
        return (
            <div className="text-center p-4 text-muted-foreground">
                No upcoming reservations found.
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Upcoming Reservations</h3>
                <Badge variant="outline">{reservations.length} Found</Badge>
            </div>
            <div className="grid gap-3">
                {reservations.map((res, index) => (
                    <Card key={index} className="bg-muted border-muted-foreground/20">
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-medium text-primary">
                                    {res.name}
                                </CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                    {res.partition || "Any Partition"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 text-sm space-y-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>
                                    {res.start_time?.number 
                                        ? convertUnixToHumanReadable(res.start_time.number) 
                                        : "N/A"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>
                                    Duration: {res.duration?.number 
                                        ? `${(res.duration.number / 60 / 60).toFixed(1)}h` 
                                        : "N/A"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Server className="w-3 h-3" />
                                <span>
                                    Nodes: {res.nodes}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
