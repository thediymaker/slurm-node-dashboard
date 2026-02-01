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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminReservations, formatTimestamp, getTimeRemaining } from "./admin-utils";
import { Search, Filter, AlertTriangle, Clock, Wrench, Calendar, Users } from "lucide-react";

interface Reservation {
    name: string;
    start_time?: { number?: number };
    end_time?: { number?: number };
    node_count?: number;
    node_list?: string;
    users?: string;
    accounts?: string;
    flags?: string[];
    features?: string;
    partition?: string;
}

export function ReservationsPanel() {
    const { data, isLoading, error } = useAdminReservations();
    const [searchTerm, setSearchTerm] = useState("");
    const [showOnlyMaintenance, setShowOnlyMaintenance] = useState(false);
    const [showOnlyActive, setShowOnlyActive] = useState(false);
    const [hideExpired, setHideExpired] = useState(true);

    // Process reservations with filtering
    const processedReservations = useMemo(() => {
        if (!data?.reservations) return [];
        
        let reservations: Reservation[] = data.reservations;
        const now = Math.floor(Date.now() / 1000);
        
        // Filter by search term
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            reservations = reservations.filter(r => 
                r.name.toLowerCase().includes(search) ||
                r.users?.toLowerCase().includes(search) ||
                r.accounts?.toLowerCase().includes(search) ||
                r.partition?.toLowerCase().includes(search)
            );
        }
        
        // Filter by maintenance
        if (showOnlyMaintenance) {
            reservations = reservations.filter(r => r.flags?.includes("MAINT"));
        }
        
        // Filter by active (started but not ended)
        if (showOnlyActive) {
            reservations = reservations.filter(r => {
                const start = r.start_time?.number ?? 0;
                const end = r.end_time?.number ?? 0;
                return start <= now && end > now;
            });
        }
        
        // Hide expired
        if (hideExpired) {
            reservations = reservations.filter(r => {
                const end = r.end_time?.number ?? 0;
                return end > now;
            });
        }
        
        // Sort by start time (soonest first)
        reservations = [...reservations].sort((a, b) => {
            const aStart = a.start_time?.number ?? 0;
            const bStart = b.start_time?.number ?? 0;
            return aStart - bStart;
        });
        
        return reservations;
    }, [data, searchTerm, showOnlyMaintenance, showOnlyActive, hideExpired]);

    // Reservation stats
    const reservationStats = useMemo(() => {
        if (!data?.reservations) return { total: 0, active: 0, maintenance: 0, upcoming: 0 };
        
        const now = Math.floor(Date.now() / 1000);
        const reservations: Reservation[] = data.reservations;
        
        return {
            total: reservations.length,
            active: reservations.filter(r => {
                const start = r.start_time?.number ?? 0;
                const end = r.end_time?.number ?? 0;
                return start <= now && end > now;
            }).length,
            maintenance: reservations.filter(r => r.flags?.includes("MAINT")).length,
            upcoming: reservations.filter(r => {
                const start = r.start_time?.number ?? 0;
                return start > now;
            }).length,
        };
    }, [data]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-medium">Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Failed to load reservation data</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-medium">Reservations</CardTitle>
                        <CardDescription>
                            <span className="inline-flex items-center gap-4">
                                <span>{reservationStats.active} active</span>
                                <span className="text-muted-foreground">•</span>
                                <span>{reservationStats.upcoming} upcoming</span>
                                {reservationStats.maintenance > 0 && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-orange-500">{reservationStats.maintenance} maintenance</span>
                                    </>
                                )}
                            </span>
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search reservations..."
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
                                    checked={hideExpired}
                                    onCheckedChange={setHideExpired}
                                >
                                    Hide expired
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showOnlyActive}
                                    onCheckedChange={setShowOnlyActive}
                                >
                                    Show only active
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showOnlyMaintenance}
                                    onCheckedChange={setShowOnlyMaintenance}
                                >
                                    Show only maintenance
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {processedReservations.length === 0 ? (
                    <div className="text-center py-8">
                        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">
                            {searchTerm || showOnlyActive || showOnlyMaintenance
                                ? "No reservations match your filters"
                                : "No active reservations"}
                        </p>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>End</TableHead>
                                    <TableHead>Time Left</TableHead>
                                    <TableHead>Nodes</TableHead>
                                    <TableHead>Users/Accounts</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TooltipProvider>
                                    {processedReservations.map((reservation) => {
                                        const isMaintenance = reservation.flags?.includes("MAINT");
                                        const timeInfo = getTimeRemaining(reservation.end_time?.number);
                                        const now = Math.floor(Date.now() / 1000);
                                        const startTime = reservation.start_time?.number ?? 0;
                                        const isActive = startTime <= now && !timeInfo.isExpired;
                                        const isUpcoming = startTime > now;

                                        return (
                                            <TableRow key={reservation.name}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {isMaintenance ? (
                                                            <Wrench className="h-4 w-4 text-orange-500" />
                                                        ) : (
                                                            <Calendar className="h-4 w-4 text-blue-500" />
                                                        )}
                                                        <span className="font-mono">{reservation.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {timeInfo.isExpired ? (
                                                        <Badge variant="secondary">Expired</Badge>
                                                    ) : isActive ? (
                                                        <Badge variant="default" className="bg-green-600">Active</Badge>
                                                    ) : isUpcoming ? (
                                                        <Badge variant="outline">Upcoming</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Unknown</Badge>
                                                    )}
                                                    {isMaintenance && (
                                                        <Badge variant="destructive" className="ml-1 text-xs">
                                                            MAINT
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatTimestamp(reservation.start_time?.number)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatTimestamp(reservation.end_time?.number)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={
                                                        timeInfo.urgency === "critical" ? "text-red-500 font-medium" :
                                                        timeInfo.urgency === "warning" ? "text-yellow-500" :
                                                        ""
                                                    }>
                                                        {isUpcoming ? `Starts in ${getTimeRemaining(startTime).text}` : timeInfo.text}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help">
                                                                {reservation.node_count ?? 
                                                                    (reservation.node_list 
                                                                        ? reservation.node_list.length > 20 
                                                                            ? `${reservation.node_list.slice(0, 20)}...` 
                                                                            : reservation.node_list
                                                                        : "—")}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-[300px] break-all">
                                                                {reservation.node_list || "No specific nodes"}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <Users className="h-3 w-3" />
                                                        <span className="text-sm truncate max-w-[150px]">
                                                            {reservation.users || reservation.accounts || "—"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TooltipProvider>
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
