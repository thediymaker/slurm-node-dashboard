"use client";
import React from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
    Shield,
    Clock,
    Cpu,
    Activity,
    AlertCircle,
    List,
    Flag,
} from "lucide-react";

interface QosInfo {
    name: string;
    priority: { number: number } | number;
    max_jobs_per_user?: { number: number } | number;
    max_submit_jobs_per_user?: { number: number } | number;
    max_wall_duration_per_job?: { number: number } | number;
    preempt_mode: string[];
    flags: string[];
    description?: string;
}

interface SlurmQosDetailsProps {
    qos: {
        qos: QosInfo[];
    };
}

const formatValue = (val: any) => {
    if (val === undefined || val === null) return "Unlimited";
    if (typeof val === 'object' && val.number !== undefined) return val.number === -1 ? "Unlimited" : val.number;
    return val === -1 ? "Unlimited" : val;
};

export function SlurmQosDetails({ qos }: SlurmQosDetailsProps) {
    if (!qos.qos || !qos.qos.length) {
        return (
            <div className="text-center p-4 text-red-400">
                Sorry, I couldn't find any QoS details.
            </div>
        );
    }

    const qosInfo = qos.qos[0];

    return (
        <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                    <div>
                        <CardTitle className="text-2xl font-semibold">
                            QoS:{" "}
                            <span className="text-primary font-mono">
                                {qosInfo.name}
                            </span>
                        </CardTitle>
                    </div>
                </div>
            </div>

            <Separator />

            <CardContent className="p-4 grid gap-4">
                {/* Priority Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <div className="p-4 rounded-xl border bg-muted flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Priority</span>
                        </div>
                        <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                            {formatValue(qosInfo.priority)}
                        </Badge>
                    </div>
                </motion.div>

                {/* Limits Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all"
                    >
                        <Activity className="w-4 h-4 text-primary" />
                        <div>
                            <div className="text-sm text-muted-foreground">Max Jobs (User)</div>
                            <div className="font-medium">{formatValue(qosInfo.max_jobs_per_user)}</div>
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all"
                    >
                        <List className="w-4 h-4 text-primary" />
                        <div>
                            <div className="text-sm text-muted-foreground">Max Submit (User)</div>
                            <div className="font-medium">{formatValue(qosInfo.max_submit_jobs_per_user)}</div>
                        </div>
                    </motion.div>
                </div>

                {/* Time Limits */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2 p-4 rounded-xl border bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Max Wall Duration</div>
                        </div>
                        <div className="font-medium">
                            {formatValue(qosInfo.max_wall_duration_per_job)} mins
                        </div>
                    </div>

                    <div className="space-y-2 p-4 rounded-xl border bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Preempt Mode</div>
                        </div>
                        <div className="font-medium">
                            {qosInfo.preempt_mode?.join(", ") || "None"}
                        </div>
                    </div>
                </div>

                {/* Flags */}
                {qosInfo.flags && qosInfo.flags.length > 0 && (
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="p-4 rounded-xl border bg-muted transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Flag className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Flags</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {qosInfo.flags.map((flag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                    {flag}
                                </Badge>
                            ))}
                        </div>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}
