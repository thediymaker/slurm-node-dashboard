"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import useSWR from "swr";

interface AdminStats {
    runningJobs: number;
    pendingJobs: number;
    onlineNodes: number;
    totalNodes: number;
    partitionCount: number;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
};

export function AdminKPICards() {
    // Fetch jobs data from diag endpoint
    const { data: diagData, isLoading: diagLoading } = useSWR(
        "/api/slurm/diag",
        fetcher,
        { refreshInterval: 15000 }
    );

    // Fetch nodes data
    const { data: nodesData, isLoading: nodesLoading } = useSWR(
        "/api/slurm/nodes",
        fetcher,
        { refreshInterval: 15000 }
    );

    // Fetch partitions data
    const { data: partitionsData, isLoading: partitionsLoading } = useSWR(
        "/api/slurm/partitions",
        fetcher,
        { refreshInterval: 15000 }
    );

    const isLoading = diagLoading || nodesLoading || partitionsLoading;

    // Calculate stats
    const stats: AdminStats = {
        runningJobs: diagData?.statistics?.jobs_running ?? 0,
        pendingJobs: diagData?.statistics?.jobs_pending ?? 0,
        onlineNodes: nodesData?.nodes?.filter(
            (n: any) => n.state?.[0] !== "DOWN" && n.state?.[1] !== "DRAIN"
        ).length ?? 0,
        totalNodes: nodesData?.nodes?.length ?? 0,
        partitionCount: partitionsData?.partitions?.length ?? 0,
    };

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                {[...Array(4)].map((_, i) => (
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

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Online Nodes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.onlineNodes} / {stats.totalNodes}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Available for scheduling
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Partitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {stats.partitionCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Active partitions
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
