"use client";
import React from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
    Server,
    Cpu,
    Clock,
    Layers,
    Activity,
    HardDrive,
} from "lucide-react";

interface PartitionInfo {
    name: string;
    nodes: string | { allowed_allocation: string; configured: string; total: number };
    total_nodes?: number | { total?: number; configured?: number };
    total_cpus?: number | { total?: number; configured?: number };
    cpus?: { total: number };
    state?: string;
    partition?: { state: string[] };
    max_time?: { number: number } | string;
    maximums?: { time: { number: number; infinite?: boolean } };
    default_memory_per_cpu?: { number: number };
    def_mem_per_cpu?: { number: number };
    defaults?: {
        partition_memory_per_cpu?: { number: number };
        partition_memory_per_node?: { number: number };
        memory_per_cpu?: number;
    };
    qos_char?: string;
}

interface SlurmPartitionDetailsProps {
    partition: {
        partitions: PartitionInfo[];
    };
}

// Helper to get state
const getState = (partInfo: PartitionInfo) => {
    if (partInfo.partition?.state?.length) return partInfo.partition.state[0];
    if (typeof partInfo.state === 'string') return partInfo.state;
    return "Unknown";
};

// Helper to get total nodes
const getTotalNodes = (partInfo: PartitionInfo) => {
    if (typeof partInfo.nodes === 'object' && partInfo.nodes !== null) {
        return partInfo.nodes.total || 0;
    }
    if (partInfo.total_nodes) {
        if (typeof partInfo.total_nodes === 'number') return partInfo.total_nodes;
        if (typeof partInfo.total_nodes === 'object') return partInfo.total_nodes.total || 0;
    }
    return 0;
};

// Helper to get node list string
const getNodeList = (partInfo: PartitionInfo) => {
    if (typeof partInfo.nodes === 'object' && partInfo.nodes !== null) {
        return partInfo.nodes.configured || "";
    }
    if (typeof partInfo.nodes === 'string') return partInfo.nodes;
    return "";
};

// Helper to get total CPUs
const getTotalCPUs = (partInfo: PartitionInfo) => {
    if (partInfo.cpus?.total) return partInfo.cpus.total;
    if (partInfo.total_cpus) {
        if (typeof partInfo.total_cpus === 'number') return partInfo.total_cpus;
        if (typeof partInfo.total_cpus === 'object') return partInfo.total_cpus.total || 0;
    }
    return 0;
};

// Helper for max time
const getMaxTime = (partInfo: PartitionInfo) => {
    if (partInfo.maximums?.time) {
        return partInfo.maximums.time.infinite ? "Infinite" : partInfo.maximums.time.number;
    }
    if (partInfo.max_time) {
        if (typeof partInfo.max_time === 'string') return partInfo.max_time;
        return partInfo.max_time.number;
    }
    return "Unlimited";
};

// Helper for memory
const getMemory = (partInfo: PartitionInfo) => {
    if (partInfo.defaults?.partition_memory_per_cpu?.number) return `${partInfo.defaults.partition_memory_per_cpu.number} MB (Per CPU)`;
    if (partInfo.defaults?.partition_memory_per_node?.number) return `${partInfo.defaults.partition_memory_per_node.number} MB (Per Node)`;
    if (partInfo.default_memory_per_cpu?.number) return `${partInfo.default_memory_per_cpu.number} MB (Per CPU)`;
    if (partInfo.def_mem_per_cpu?.number) return `${partInfo.def_mem_per_cpu.number} MB (Per CPU)`;
    return "Not Configured";
};

export function SlurmPartitionDetails({ partition }: SlurmPartitionDetailsProps) {
    if (!partition.partitions || !partition.partitions.length) {
        return (
            <div className="text-center p-4 text-red-400">
                Sorry, I couldn't find any partition details.
            </div>
        );
    }

    const partInfo = partition.partitions[0];

    return (
        <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                    <div>
                        <CardTitle className="text-2xl font-semibold">
                            Partition:{" "}
                            <span className="text-primary font-mono">
                                {partInfo.name}
                            </span>
                        </CardTitle>
                    </div>
                </div>
            </div>

            <Separator />

            <CardContent className="p-4 grid gap-4">
                {/* Status Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <div className="p-4 rounded-xl border bg-muted flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">State</span>
                        </div>
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            {getState(partInfo)}
                        </Badge>
                    </div>
                </motion.div>

                {/* Resources Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all"
                    >
                        <Server className="w-4 h-4 text-primary" />
                        <div>
                            <div className="text-sm text-muted-foreground">Total Nodes</div>
                            <div className="font-medium">{getTotalNodes(partInfo)}</div>
                        </div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all"
                    >
                        <Cpu className="w-4 h-4 text-primary" />
                        <div>
                            <div className="text-sm text-muted-foreground">Total CPUs</div>
                            <div className="font-medium">{getTotalCPUs(partInfo)}</div>
                        </div>
                    </motion.div>
                </div>

                {/* Configuration Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2 p-4 rounded-xl border bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Max Time</div>
                        </div>
                        <div className="font-medium">
                            {getMaxTime(partInfo)}
                        </div>
                    </div>

                    <div className="space-y-2 p-4 rounded-xl border bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                            <HardDrive className="w-4 h-4 text-primary" />
                            <div className="text-sm text-muted-foreground">Default Mem/CPU</div>
                        </div>
                        <div className="font-medium">
                            {getMemory(partInfo)}
                        </div>
                    </div>
                </div>

                {/* Nodes List */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="p-4 rounded-xl border bg-muted transition-all"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <div className="text-sm text-muted-foreground">Nodes</div>
                    </div>
                    <div className="font-medium text-sm break-all font-mono">
                        {getNodeList(partInfo)}
                    </div>
                </motion.div>
            </CardContent>
        </Card>
    );
}
