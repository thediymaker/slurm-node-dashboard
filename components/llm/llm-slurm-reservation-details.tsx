"use client";
import React from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import {
    Calendar,
    Clock,
    Users,
    Server,
    Tag,
    Flag,
} from "lucide-react";

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

interface SlurmReservationDetailsProps {
    reservation: {
        reservations: ReservationInfo[];
    };
}

const formatCount = (value: number | { number: number } | undefined) => {
    if (typeof value === 'object' && value !== null) {
        return value.number;
    }
    return value ?? 0;
};

export function SlurmReservationDetails({ reservation }: SlurmReservationDetailsProps) {
    if (!reservation.reservations || !reservation.reservations.length) {
        return (
            <div className="text-center p-4 text-red-400">
                Sorry, I couldn't find any reservation details.
            </div>
        );
    }

    const resInfo = reservation.reservations[0];

    return (
        <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                    <div>
                        <CardTitle className="text-2xl font-semibold">
                            Reservation:{" "}
                            <span className="text-primary font-mono">
                                {resInfo.name}
                            </span>
                        </CardTitle>
                    </div>
                </div>
            </div>

            <Separator />

            <CardContent className="p-4 grid gap-4">
                {/* Time Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2 p-4 rounded-xl border bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Start Time</div>
                        </div>
                        <div className="font-medium">
                            {resInfo.start_time?.number
                                ? convertUnixToHumanReadable(resInfo.start_time.number)
                                : "N/A"}
                        </div>
                    </div>

                    <div className="space-y-2 p-4 rounded-xl border bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">End Time</div>
                        </div>
                        <div className="font-medium">
                            {resInfo.end_time?.number
                                ? convertUnixToHumanReadable(resInfo.end_time.number)
                                : "N/A"}
                        </div>
                    </div>
                </div>

                {/* Resources Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all"
                    >
                        <Server className="w-4 h-4 text-primary" />
                        <div>
                            <div className="text-sm text-muted-foreground">Nodes</div>
                            <div className="font-medium">{formatCount(resInfo.node_cnt)} ({resInfo.nodes})</div>
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all"
                    >
                        <Users className="w-4 h-4 text-primary" />
                        <div>
                            <div className="text-sm text-muted-foreground">Users</div>
                            <div className="font-medium truncate max-w-[150px]">{resInfo.users || "None"}</div>
                        </div>
                    </motion.div>
                </div>

                {/* Details Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="p-4 rounded-xl border bg-muted transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Tag className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Partition</div>
                        </div>
                        <div className="font-medium">{resInfo.partition || "Any"}</div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="p-4 rounded-xl border bg-muted transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Flag className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Accounts</div>
                        </div>
                        <div className="font-medium">{resInfo.accounts || "None"}</div>
                    </motion.div>
                </div>
            </CardContent>
        </Card>
    );
}
