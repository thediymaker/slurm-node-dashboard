"use client";
import React, { memo, useMemo } from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  AlertCircle,
} from "lucide-react";
import {
  CopyButton,
  EmptyState,
  formatDuration,
} from "./llm-shared-utils";
import {
  ReservationRecord,
  formatReservationRelativeTime,
  formatReservationTime,
  normalizeReservation,
} from "./llm-slurm-reservation-utils";

interface SlurmReservationDetailsProps {
  reservation: {
    reservations: ReservationRecord[];
  };
}

function SlurmReservationDetailsComponent({ reservation }: SlurmReservationDetailsProps) {
  const reservationData = useMemo(() => {
    if (!reservation?.reservations?.length) return null;

    return normalizeReservation(reservation.reservations[0]);
  }, [reservation]);

  if (!reservationData) {
    return (
      <EmptyState 
        message="Sorry, I couldn't find any reservation details."
        icon={<AlertCircle className="w-8 h-8 mx-auto" />}
      />
    );
  }

  const { 
    name,
    partition,
    startTime,
    endTime,
    durationSeconds,
    status,
    nodeCount,
    coreCount,
    nodeList,
    users,
    accounts,
    flags,
  } = reservationData;
  const durationMinutes = durationSeconds > 0 ? durationSeconds / 60 : 0;

  return (
    <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            status.label === 'Active' ? 'bg-emerald-500/10' :
            status.label === 'Upcoming' ? 'bg-blue-500/10' : 'bg-gray-500/10'
          }`}>
            <CalendarClock className={`w-4 h-4 ${
              status.label === 'Active' ? 'text-emerald-400' :
              status.label === 'Upcoming' ? 'text-blue-400' : 'text-gray-400'
            }`} />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span className="text-muted-foreground">Reservation</span>
              <span className="text-primary font-mono">{name}</span>
              <CopyButton text={name} />
            </CardTitle>
            {partition && <div className="text-xs text-muted-foreground">Partition: {partition}</div>}
          </div>
        </div>
        <Badge variant="secondary" className={status.color}>
          {status.label}
        </Badge>
      </div>

      <Separator />

      <CardContent className="p-4 space-y-3">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Nodes</div>
            <div className="font-semibold text-primary">{nodeCount}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Cores</div>
            <div className="font-semibold">{coreCount}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="font-medium text-sm">{durationMinutes > 0 ? formatDuration(durationMinutes) : 'N/A'}</div>
          </div>
          <div className="p-2 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">Partition</div>
            <div className="font-medium text-sm truncate">{partition || 'Any'}</div>
          </div>
        </div>

        {/* Time Info Row */}
        <div className="flex items-center gap-4 text-xs py-2 px-3 bg-muted/30 rounded-lg flex-wrap">
          <span>
            <span className="text-muted-foreground">Start:</span>{' '}
            <span className="font-medium">{formatReservationTime(startTime)}</span>
            {startTime > 0 && <span className="text-muted-foreground ml-1">({formatReservationRelativeTime(startTime)})</span>}
          </span>
          <span className="text-muted-foreground">→</span>
          <span>
            <span className="text-muted-foreground">End:</span>{' '}
            <span className="font-medium">{formatReservationTime(endTime)}</span>
            {endTime > 0 && <span className="text-muted-foreground ml-1">({formatReservationRelativeTime(endTime)})</span>}
          </span>
        </div>

        {/* Users/Accounts Row */}
        <div className="flex items-center gap-4 text-xs py-2 px-3 bg-muted/30 rounded-lg">
          <span>
            <span className="text-muted-foreground">Users:</span>{' '}
            <span className="font-medium">{users || 'All'}</span>
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">Accounts:</span>{' '}
            <span className="font-medium">{accounts || 'All'}</span>
          </span>
        </div>

        {/* Node List - only if present */}
        {nodeList && (
          <div className="py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Nodes</span>
              <CopyButton text={nodeList} />
            </div>
            <code className="text-xs font-mono text-muted-foreground break-all block">
              {nodeList.length > 100 ? `${nodeList.slice(0, 100)}...` : nodeList}
            </code>
          </div>
        )}

        {/* Flags - only if present */}
        {flags.length > 0 && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-muted-foreground">Flags:</span>
            {flags.map((flag: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs py-0 h-5">
                {flag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const SlurmReservationDetails = memo(SlurmReservationDetailsComponent);
export default SlurmReservationDetails;
