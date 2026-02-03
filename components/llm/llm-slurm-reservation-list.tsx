"use client";
import React, { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Server, CalendarClock, Users } from "lucide-react";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import { motion } from "framer-motion";
import {
  formatRelativeTime,
  formatDuration,
  EmptyState,
} from "./llm-shared-utils";

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

interface SlurmReservationListProps {
  reservations: ReservationInfo[];
}

const getTimeStatus = (startTime: number, endTime: number) => {
  const now = Date.now() / 1000;
  if (now < startTime) return { label: 'Upcoming', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  if (now >= startTime && now < endTime) return { label: 'Active', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  return { label: 'Expired', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
};

const formatNodeCount = (value: number | { number: number } | undefined): number => {
  if (typeof value === 'object' && value !== null) return value.number;
  return value ?? 0;
};

function SlurmReservationListComponent({ reservations }: SlurmReservationListProps) {
  const sortedReservations = useMemo(() => {
    if (!Array.isArray(reservations) || reservations.length === 0) return [];
    
    return [...reservations].sort((a, b) => {
      const aStart = a.start_time?.number || 0;
      const bStart = b.start_time?.number || 0;
      return aStart - bStart;
    });
  }, [reservations]);

  if (sortedReservations.length === 0) {
    return (
      <EmptyState
        message="No reservations found."
        icon={<CalendarClock className="w-8 h-8 mx-auto" />}
      />
    );
  }

  const activeCount = sortedReservations.filter(r => {
    const now = Date.now() / 1000;
    return now >= (r.start_time?.number || 0) && now < (r.end_time?.number || 0);
  }).length;

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          Reservations
        </h3>
        <div className="flex gap-2">
          {activeCount > 0 && (
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {activeCount} Active
            </Badge>
          )}
          <Badge variant="outline">{sortedReservations.length} Total</Badge>
        </div>
      </div>
      
      <div className="grid gap-3">
        {sortedReservations.map((res, index) => {
          const startTime = res.start_time?.number || 0;
          const endTime = res.end_time?.number || 0;
          const status = getTimeStatus(startTime, endTime);
          const durationHours = res.duration?.number ? res.duration.number / 3600 : 0;
          
          return (
            <motion.div
              key={res.name || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-muted/50 border hover:border-primary/30 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base font-medium text-primary font-mono">
                      {res.name}
                    </CardTitle>
                    <Badge variant="secondary" className={`${status.color} text-xs shrink-0`}>
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {startTime ? formatRelativeTime(startTime) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>
                        {durationHours > 0 ? `${durationHours.toFixed(1)}h` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Server className="w-3 h-3 shrink-0" />
                      <span className="truncate font-mono text-xs">
                        {res.nodes || `${formatNodeCount(res.node_cnt)} nodes`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {res.users || res.accounts || 'All'}
                      </span>
                    </div>
                  </div>
                  {res.partition && (
                    <div className="pt-1">
                      <Badge variant="outline" className="text-xs">
                        {res.partition}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export const SlurmReservationList = memo(SlurmReservationListComponent);
export default SlurmReservationList;
