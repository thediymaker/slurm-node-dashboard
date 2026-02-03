"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminPartitions, formatDuration, getPartitionState, sortByKey, SortDirection, type AdminPartitionSummary } from "./admin-utils";
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";

type Partition = AdminPartitionSummary;

type SortKey = "name" | "state" | "nodes" | "cpus";

export function PartitionsPanel() {
    const { data, isLoading, error } = useAdminPartitions();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [showOnlyUp, setShowOnlyUp] = useState(false);
    const [showOnlyDefault, setShowOnlyDefault] = useState(false);

    // Process partitions with sorting and filtering
    const processedPartitions = useMemo(() => {
        if (!data?.partitions) return [];
        
        let partitions: Partition[] = data.partitions;
        
        // Filter by search term
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            partitions = partitions.filter(p => 
                p.name.toLowerCase().includes(search)
            );
        }
        
        // Filter by state
        if (showOnlyUp) {
            partitions = partitions.filter(p => {
                const state = getPartitionState(p);
                return state === "UP";
            });
        }
        
        // Filter by default
        if (showOnlyDefault) {
            partitions = partitions.filter(p => p.partition?.default);
        }
        
        // Sort
        partitions = [...partitions].sort((a, b) => {
            let aVal: any, bVal: any;
            
            switch (sortKey) {
                case "name":
                    aVal = a.name;
                    bVal = b.name;
                    break;
                case "state":
                    aVal = getPartitionState(a);
                    bVal = getPartitionState(b);
                    break;
                case "nodes":
                    aVal = a.nodes?.total ?? 0;
                    bVal = b.nodes?.total ?? 0;
                    break;
                case "cpus":
                    aVal = a.cpus?.total ?? 0;
                    bVal = b.cpus?.total ?? 0;
                    break;
                default:
                    return 0;
            }
            
            if (aVal === bVal) return 0;
            const comparison = aVal < bVal ? -1 : 1;
            return sortDirection === "asc" ? comparison : -comparison;
        });
        
        return partitions;
    }, [data, searchTerm, sortKey, sortDirection, showOnlyUp, showOnlyDefault]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
        return sortDirection === "asc" 
            ? <ArrowUp className="ml-1 h-3 w-3" /> 
            : <ArrowDown className="ml-1 h-3 w-3" />;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Partitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        const errorMessage = error?.message || "Failed to load partition data";
        const isConnectionError = errorMessage.includes("Unable to contact Slurm controller") || 
                                   errorMessage.includes("service may be down");
        
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Partitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">
                                {isConnectionError ? "Unable to contact Slurm controller" : "Failed to load partition data"}
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

    const totalPartitions = data?.partitions?.length ?? 0;
    const upPartitions = data?.partitions?.filter((p: Partition) => getPartitionState(p) === "UP").length ?? 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-medium">Partitions</CardTitle>
                        <CardDescription>
                            {upPartitions} of {totalPartitions} partitions UP
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search partitions..."
                                className="pl-8 w-[200px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Filter className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuCheckboxItem
                                    checked={showOnlyUp}
                                    onCheckedChange={setShowOnlyUp}
                                >
                                    Show only UP
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showOnlyDefault}
                                    onCheckedChange={setShowOnlyDefault}
                                >
                                    Show only Default
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {processedPartitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        {searchTerm || showOnlyUp || showOnlyDefault 
                            ? "No partitions match your filters" 
                            : "No partitions found"}
                    </p>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead 
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("name")}
                                    >
                                        <div className="flex items-center">
                                            Name
                                            <SortIcon columnKey="name" />
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("state")}
                                    >
                                        <div className="flex items-center">
                                            State
                                            <SortIcon columnKey="state" />
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("nodes")}
                                    >
                                        <div className="flex items-center">
                                            Nodes
                                            <SortIcon columnKey="nodes" />
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleSort("cpus")}
                                    >
                                        <div className="flex items-center">
                                            CPUs
                                            <SortIcon columnKey="cpus" />
                                        </div>
                                    </TableHead>
                                    <TableHead>Max Time</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Default</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedPartitions.map((partition) => {
                                    const state = getPartitionState(partition);
                                    const isUp = state === "UP";
                                    const isDefault = partition.partition?.default ?? false;

                                    return (
                                        <TableRow key={partition.name}>
                                            <TableCell className="font-medium font-mono">
                                                {partition.name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={isUp ? "default" : "secondary"}
                                                    className={isUp ? "bg-green-600 hover:bg-green-700" : ""}
                                                >
                                                    {state}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{partition.nodes?.total?.toLocaleString() ?? "—"}</TableCell>
                                            <TableCell>{partition.cpus?.total?.toLocaleString() ?? "—"}</TableCell>
                                            <TableCell>
                                                {formatDuration(
                                                    partition.maximums?.time?.number,
                                                    { infinite: partition.maximums?.time?.infinite }
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {partition.priority?.job_factor?.toLocaleString() ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                {isDefault ? (
                                                    <Badge variant="outline" className="border-blue-500 text-blue-600">
                                                        Default
                                                    </Badge>
                                                ) : (
                                                    "—"
                                                )}
                                            </TableCell>
                                        </TableRow>
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
