"use client";
import React, { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Server, CalendarClock, Users } from "lucide-react";
import { motion } from "framer-motion";
import { CopyButton, EmptyState, formatDuration } from "./llm-shared-utils";
import {
  ReservationRecord,
  formatReservationRelativeTime,
  formatReservationWindow,
  normalizeReservation,
} from "./llm-slurm-reservation-utils";

interface SlurmReservationListProps {
  reservations: ReservationRecord[];
}

function SlurmReservationListComponent({ reservations }: SlurmReservationListProps) {
  const sortedReservations = useMemo(() => {
    if (!Array.isArray(reservations) || reservations.length === 0) return [];
    
    return reservations.map(normalizeReservation).sort((a, b) => {
      return a.startTime - b.startTime;
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
    return r.status.label === "Active";
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
          const durationMinutes = res.durationSeconds > 0 ? res.durationSeconds / 60 : 0;
          const accessLabel = res.users || res.accounts || "All";
          const nodeLabel = res.nodeCount > 0 ? `${res.nodeCount} nodes` : "N/A";
          
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
                    <Badge variant="secondary" className={`${res.status.color} text-xs shrink-0`}>
                      {res.status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 text-sm space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                      <Calendar className="w-3 h-3 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-foreground break-words">
                          {formatReservationWindow(res.startTime, res.endTime)}
                        </div>
                        {res.startTime > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Starts {formatReservationRelativeTime(res.startTime)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>
                        {durationMinutes > 0 ? formatDuration(durationMinutes) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Server className="w-3 h-3 shrink-0" />
                      <span className="font-mono text-xs">
                        {nodeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {accessLabel}
                      </span>
                    </div>
                    {res.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {res.flags.map((flag) => (
                          <Badge key={flag} variant="outline" className="text-xs py-0 h-5">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {res.nodeList && (
                    <div className="py-2 px-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-xs text-muted-foreground">Nodes</span>
                        <CopyButton text={res.nodeList} />
                      </div>
                      <code className="text-xs font-mono text-muted-foreground break-all whitespace-pre-wrap block">
                        {res.nodeList}
                      </code>
                    </div>
                  )}
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
