"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import useSWR from "swr";
import { useEffect, useState } from "react";

interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion: string;
    url: string;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
};

export function SystemInfoPanel() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);

    // Fetch diag for Slurm info
    const { data: diagData, isLoading: diagLoading } = useSWR(
        "/api/slurm/diag",
        fetcher,
        { refreshInterval: 60000 }
    );

    // Check for updates on mount
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

    const slurmVersion = diagData?.meta?.slurm?.release ?? "Unknown";
    const serverTime = diagData?.statistics?.server_thread_count
        ? "Connected"
        : "Unknown";

    return (
        <div className="space-y-6">
            {/* Version Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Application</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Version</span>
                        {isCheckingUpdate ? (
                            <Skeleton className="h-5 w-20" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="font-medium">
                                    v{updateInfo?.latestVersion ?? "Unknown"}
                                </span>
                                {updateInfo?.hasUpdate && (
                                    <a
                                        href={updateInfo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Badge variant="default" className="cursor-pointer">
                                            Update Available
                                        </Badge>
                                    </a>
                                )}
                                {!updateInfo?.hasUpdate && !isCheckingUpdate && (
                                    <Badge variant="secondary">Up to date</Badge>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Slurm Connection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Slurm Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {diagLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-full" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <Badge variant={diagData ? "default" : "destructive"}>
                                    {diagData ? "Connected" : "Disconnected"}
                                </Badge>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Slurm Version</span>
                                <span className="font-medium">{slurmVersion}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">API Version</span>
                                <span className="font-medium">
                                    {process.env.NEXT_PUBLIC_SLURM_API_VERSION ?? "v0.0.40"}
                                </span>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Environment */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Environment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Mode</span>
                        <Badge variant="outline">
                            {process.env.NODE_ENV ?? "development"}
                        </Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Base URL</span>
                        <span className="font-medium text-sm">
                            {process.env.NEXT_PUBLIC_BASE_URL ?? "localhost:3000"}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
