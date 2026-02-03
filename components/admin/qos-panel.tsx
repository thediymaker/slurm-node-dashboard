"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdminQoS, extractSlurmValue, formatDuration, getSlurmNumber, SlurmValue } from "./admin-utils";
import { Search, ChevronDown, ChevronRight, AlertTriangle, Shield, Gauge } from "lucide-react";

interface QoS {
    name: string;
    description?: string;
    priority?: SlurmValue;
    limits?: {
        max?: {
            jobs?: { per?: { user?: SlurmValue; account?: SlurmValue } };
            wall_clock?: { per?: { qos?: SlurmValue; job?: SlurmValue } };
            tres?: { per?: { user?: any[]; job?: any[]; node?: any[] } };
            accruing?: { per?: { account?: SlurmValue } };
        };
        min?: {
            tres?: { per?: { job?: any[] } };
        };
        factor?: number;
    };
    preempt?: { mode?: string[]; list?: string[] };
    usage_factor?: SlurmValue;
    flags?: string[];
}

export function QoSPanel() {
    const { data, isLoading, error } = useAdminQoS();
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Process QoS with filtering
    const filteredQoS = useMemo(() => {
        if (!data?.qos) return [];
        
        let qosList: QoS[] = data.qos;
        
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            qosList = qosList.filter(q => 
                q.name.toLowerCase().includes(search) ||
                q.description?.toLowerCase().includes(search)
            );
        }
        
        // Sort by priority (highest first), then by name
        return [...qosList].sort((a, b) => {
            const aPriority = getSlurmNumber(a.priority) ?? 0;
            const bPriority = getSlurmNumber(b.priority) ?? 0;
            if (aPriority !== bPriority) return bPriority - aPriority;
            return a.name.localeCompare(b.name);
        });
    }, [data, searchTerm]);

    const toggleRow = (name: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    // Format TRES limits for display
    const formatTresLimits = (tres?: any[]): string => {
        if (!tres || tres.length === 0) return "—";
        return tres
            .filter(t => t.count !== undefined && t.count > 0)
            .map(t => `${t.type}${t.name ? `/${t.name}` : ""}=${t.count}`)
            .join(", ") || "—";
    };

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
        const errorMessage = error?.message || "Failed to load QoS data";
        const isConnectionError = errorMessage.includes("Unable to contact Slurm controller") || 
                                   errorMessage.includes("service may be down");
        
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Quality of Service</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">
                                {isConnectionError ? "Unable to contact Slurm controller" : "Failed to load QoS data"}
                            </span>
                            {isConnectionError && (
                                <span className="text-xs text-muted-foreground mt-1">
                                    The Slurm controller may be down or unreachable.
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const totalQoS = data?.qos?.length ?? 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-medium">Quality of Service</CardTitle>
                        <CardDescription>
                            {totalQoS} QoS configurations defined
                        </CardDescription>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search QoS..."
                            className="pl-8 w-[200px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {filteredQoS.length === 0 ? (
                    <div className="text-center py-8">
                        <Gauge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">
                            {searchTerm ? "No QoS entries match your search" : "No QoS entries found"}
                        </p>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30px]"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Max Jobs/User</TableHead>
                                    <TableHead>Max Wall Time</TableHead>
                                    <TableHead>Preempt Mode</TableHead>
                                    <TableHead>Flags</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredQoS.map((qos) => {
                                    const isExpanded = expandedRows.has(qos.name);
                                    const priority = getSlurmNumber(qos.priority);
                                    const hasDetails = qos.description || 
                                        qos.limits?.max?.tres?.per?.user?.length ||
                                        qos.limits?.max?.tres?.per?.job?.length ||
                                        qos.preempt?.list?.length;

                                    return (
                                        <React.Fragment key={qos.name}>
                                            <TableRow 
                                                className={hasDetails ? "cursor-pointer hover:bg-muted/50" : ""}
                                                onClick={() => hasDetails && toggleRow(qos.name)}
                                            >
                                                <TableCell>
                                                    {hasDetails && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleRow(qos.name);
                                                            }}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                                    <TableCell className="font-medium font-mono">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                                            {qos.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {priority !== undefined && priority !== Infinity ? (
                                                            <Badge variant={priority > 0 ? "default" : "secondary"}>
                                                                {priority.toLocaleString()}
                                                            </Badge>
                                                        ) : (
                                                            extractSlurmValue(qos.priority)
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {extractSlurmValue(qos.limits?.max?.jobs?.per?.user)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDuration(
                                                            getSlurmNumber(qos.limits?.max?.wall_clock?.per?.qos),
                                                            { infinite: qos.limits?.max?.wall_clock?.per?.qos?.infinite }
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {qos.preempt?.mode?.join(", ") || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {qos.flags?.slice(0, 3).map(flag => (
                                                                <Badge key={flag} variant="outline" className="text-xs">
                                                                    {flag}
                                                                </Badge>
                                                            ))}
                                                            {(qos.flags?.length ?? 0) > 3 && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    +{(qos.flags?.length ?? 0) - 3}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {hasDetails && isExpanded && (
                                                    <TableRow className="bg-muted/30">
                                                        <TableCell colSpan={7} className="p-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                                    {qos.description && (
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs uppercase mb-1">Description</p>
                                                                            <p>{qos.description}</p>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {qos.limits?.max?.tres?.per?.user?.length ? (
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs uppercase mb-1">Max TRES Per User</p>
                                                                            <code className="text-xs bg-muted p-1 rounded">
                                                                                {formatTresLimits(qos.limits.max.tres.per.user)}
                                                                            </code>
                                                                        </div>
                                                                    ) : null}
                                                                    
                                                                    {qos.limits?.max?.tres?.per?.job?.length ? (
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs uppercase mb-1">Max TRES Per Job</p>
                                                                            <code className="text-xs bg-muted p-1 rounded">
                                                                                {formatTresLimits(qos.limits.max.tres.per.job)}
                                                                            </code>
                                                                        </div>
                                                                    ) : null}
                                                                    
                                                                    {qos.preempt?.list?.length ? (
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs uppercase mb-1">Can Preempt</p>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {qos.preempt.list.map(p => (
                                                                                    <Badge key={p} variant="secondary" className="text-xs">
                                                                                        {p}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                    
                                                                    {(qos.flags?.length ?? 0) > 3 && (
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs uppercase mb-1">All Flags</p>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {qos.flags?.map(flag => (
                                                                                    <Badge key={flag} variant="outline" className="text-xs">
                                                                                        {flag}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                )}
                                            </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
