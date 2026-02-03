"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
    useAdminDiag, 
    useAdminNodes, 
    useAdminPartitions, 
    isNodeAvailable,
    parseNodeState 
} from "./admin-utils";
import { AlertTriangle } from "lucide-react";

interface NodeStats {
    total: number;
    available: number;
    allocated: number;
    idle: number;
    down: number;
    draining: number;
    mixed: number;
}

interface AdminStats {
    runningJobs: number;
    pendingJobs: number;
    totalJobs: number;
    nodeStats: NodeStats;
    partitionCount: number;
    upPartitions: number;
    totalCpus: number;
    allocatedCpus: number;
}

export function AdminKPICards() {
    const { data: diagData, isLoading: diagLoading, error: diagError } = useAdminDiag();
    const { data: nodesData, isLoading: nodesLoading, error: nodesError } = useAdminNodes();
    const { data: partitionsData, isLoading: partitionsLoading, error: partitionsError } = useAdminPartitions();

    const isLoading = diagLoading || nodesLoading || partitionsLoading;
    const hasError = diagError || nodesError || partitionsError;
    const hasData = diagData || nodesData || partitionsData;

    // Calculate node statistics with proper state parsing
    const nodeStats = useMemo((): NodeStats => {
        if (!nodesData?.nodes) {
            return { total: 0, available: 0, allocated: 0, idle: 0, down: 0, draining: 0, mixed: 0 };
        }

        const stats: NodeStats = { total: 0, available: 0, allocated: 0, idle: 0, down: 0, draining: 0, mixed: 0 };
        
        for (const node of nodesData.nodes) {
            stats.total++;
            const flags = parseNodeState(node.state);
            
            if (flags.isDown) {
                stats.down++;
            } else if (flags.isDraining || flags.isDrained) {
                stats.draining++;
            } else {
                stats.available++;
                if (flags.isAllocated) stats.allocated++;
                else if (flags.isMixed) stats.mixed++;
                else if (flags.isIdle) stats.idle++;
            }
        }
        
        return stats;
    }, [nodesData]);

    // Calculate CPU statistics
    const cpuStats = useMemo(() => {
        if (!nodesData?.nodes) {
            return { total: 0, allocated: 0 };
        }
        
        let total = 0;
        let allocated = 0;
        
        for (const node of nodesData.nodes) {
            const nodeCpus = node.cpus ?? 0;
            const nodeAllocCpus = node.alloc_cpus ?? 0;
            
            if (isNodeAvailable(node.state)) {
                total += nodeCpus;
                allocated += nodeAllocCpus;
            }
        }
        
        return { total, allocated };
    }, [nodesData]);

    // Calculate partition stats
    const partitionStats = useMemo(() => {
        if (!partitionsData?.partitions) {
            return { total: 0, up: 0 };
        }
        
        const partitions = partitionsData.partitions;
        const upPartitions = partitions.filter((p: any) => {
            const state = Array.isArray(p.state) ? p.state[0] : p.state?.current?.[0];
            return state === "UP";
        }).length;
        
        return { total: partitions.length, up: upPartitions };
    }, [partitionsData]);

    const stats: AdminStats = {
        runningJobs: diagData?.statistics?.jobs_running ?? 0,
        pendingJobs: diagData?.statistics?.jobs_pending ?? 0,
        totalJobs: (diagData?.statistics?.jobs_running ?? 0) + (diagData?.statistics?.jobs_pending ?? 0),
        nodeStats,
        partitionCount: partitionStats.total,
        upPartitions: partitionStats.up,
        totalCpus: cpuStats.total,
        allocatedCpus: cpuStats.allocated,
    };

    const nodeUtilization = stats.nodeStats.total > 0 
        ? Math.round((stats.nodeStats.allocated + stats.nodeStats.mixed) / stats.nodeStats.available * 100) || 0
        : 0;
    
    const cpuUtilization = stats.totalCpus > 0 
        ? Math.round(stats.allocatedCpus / stats.totalCpus * 100) 
        : 0;

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
                {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-1" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    // Only show full error when we have no data at all
    if (hasError && !hasData) {
        const errorMessage = diagError?.message || nodesError?.message || partitionsError?.message || "Failed to load cluster statistics";
        const isConnectionError = errorMessage.includes("Unable to contact Slurm controller") || 
                                   errorMessage.includes("service may be down");
        
        return (
            <div className="rounded-md bg-destructive/15 p-4 mb-6">
                <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">
                            {isConnectionError ? "Unable to contact Slurm controller" : "Failed to load cluster statistics"}
                        </span>
                        {isConnectionError && (
                            <span className="text-xs text-muted-foreground mt-1">
                                The Slurm controller may be down or unreachable.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
            {/* Running Jobs */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Running Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.runningJobs.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Currently executing
                    </p>
                </CardContent>
            </Card>

            {/* Pending Jobs */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.pendingJobs.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Waiting in queue
                    </p>
                </CardContent>
            </Card>

            {/* Online Nodes */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Online Nodes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.nodeStats.available} 
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                            / {stats.nodeStats.total}
                        </span>
                    </div>
                    <div className="mt-2">
                        <Progress value={nodeUtilization} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">
                            {nodeUtilization}% utilized
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* CPU Utilization */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU Cores</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.allocatedCpus.toLocaleString()}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                            / {stats.totalCpus.toLocaleString()}
                        </span>
                    </div>
                    <div className="mt-2">
                        <Progress value={cpuUtilization} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">
                            {cpuUtilization}% allocated
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Partitions */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Partitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.upPartitions}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                            / {stats.partitionCount}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Partitions UP
                    </p>
                </CardContent>
            </Card>

            {/* Node Issues */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Node Issues</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${stats.nodeStats.down + stats.nodeStats.draining > 0 ? 'text-destructive' : ''}`}>
                        {stats.nodeStats.down + stats.nodeStats.draining}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {stats.nodeStats.down} down, {stats.nodeStats.draining} draining
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
