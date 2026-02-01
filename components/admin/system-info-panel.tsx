"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAdminDiag } from "./admin-utils";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import packageJson from "@/package.json";

interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion: string;
    url: string;
}

export function SystemInfoPanel() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data: diagData, isLoading: diagLoading, error: diagError, mutate: mutateDiag } = useAdminDiag();

    useEffect(() => {
        async function checkForUpdate() {
            try {
                const { checkUpdate } = await import("@/actions/check-update");
                const result = await checkUpdate();
                setUpdateInfo(result);
            } catch (error) {
                console.error("Failed to check for updates:", error);
            } finally {
                setIsCheckingUpdate(false);
            }
        }
        checkForUpdate();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await mutateDiag();
        setIsRefreshing(false);
    };

    const slurmVersion = diagData?.meta?.slurm?.release ?? "Unknown";
    const stats = diagData?.statistics ?? {};
    const serverStartTime = stats.server_start_time?.number;
    const uptimeText = serverStartTime 
        ? formatUptime(Math.floor(Date.now() / 1000) - serverStartTime)
        : "Unknown";

    const apiVersion = process.env.NEXT_PUBLIC_SLURM_API_VERSION ?? "v0.0.40";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "localhost:3000";
    const nodeEnv = process.env.NODE_ENV ?? "development";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Application */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Application</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Version</span>
                        <span className="font-mono text-sm">v{packageJson.version}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Update Status</span>
                        {isCheckingUpdate ? (
                            <Skeleton className="h-5 w-20" />
                        ) : updateInfo?.hasUpdate ? (
                            <a href={updateInfo.url} target="_blank" rel="noopener noreferrer">
                                <Badge variant="default">v{updateInfo.latestVersion} available</Badge>
                            </a>
                        ) : (
                            <span className="text-sm text-muted-foreground">Up to date</span>
                        )}
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Environment</span>
                        <Badge variant="outline">{nodeEnv}</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Base URL</span>
                        <span className="font-mono text-sm text-muted-foreground">{baseUrl}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Slurm Connection */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium">Slurm Connection</CardTitle>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {diagLoading ? (
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-5 w-full" />
                            ))}
                        </div>
                    ) : diagError ? (
                        <p className="text-sm text-destructive">Failed to connect</p>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <Badge variant="outline" className="text-green-600 border-green-600">Connected</Badge>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Slurm Version</span>
                                <span className="font-mono text-sm">{slurmVersion}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">API Version</span>
                                <span className="font-mono text-sm">{apiVersion}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Uptime</span>
                                <span className="text-sm">{uptimeText}</span>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Controller Statistics */}
            <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Controller Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                    {diagLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                            {[...Array(8)].map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                            ))}
                        </div>
                    ) : diagError ? (
                        <p className="text-sm text-muted-foreground">Unable to fetch statistics</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                            <StatItem label="Server Threads" value={stats.server_thread_count ?? 0} />
                            <StatItem label="Agent Count" value={stats.agent_count ?? 0} />
                            <StatItem label="Cycle (Last)" value={`${(stats.schedule_cycle_last ?? 0).toLocaleString()} µs`} />
                            <StatItem label="Cycle (Mean)" value={`${(stats.schedule_cycle_mean ?? 0).toLocaleString()} µs`} />
                            <StatItem label="Cycle (Max)" value={`${(stats.schedule_cycle_max ?? 0).toLocaleString()} µs`} />
                            <StatItem label="Backfill" value={stats.bf_active ? "Active" : "Inactive"} />
                            <StatItem label="BF Cycles" value={(stats.bf_cycle_counter ?? 0).toLocaleString()} />
                            <StatItem label="DBD Queue" value={stats.dbd_agent_queue_size ?? 0} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="p-3 rounded-md border bg-muted/30">
            <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm font-medium">{value}</p>
        </div>
    );
}

function formatUptime(seconds: number): string {
    if (seconds <= 0) return "Just started";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}
