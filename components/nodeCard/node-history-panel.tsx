"use client";

import useSWR from "swr";
import { format, formatDistanceStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeature } from "@/components/runtime-config";
import { withBasePath } from "@/lib/base-path";
import type { NodeHistoryEntry } from "@/lib/node-history";

const DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function stateColor(state: string) {
  if (/DOWN|FAIL|ERROR|NOT_RESPONDING|INVALID_REG/.test(state)) return "bg-red-500";
  if (state.includes("DRAIN")) return "bg-amber-500";
  return "bg-sky-500";
}

// When a node was drained or down over the last 30 days, and why
export function NodeHistoryPanel({ nodeName }: { nodeName: string }) {
  const enabled = useFeature("nodeHistory");
  const { data, isLoading } = useSWR<{ enabled: boolean; now?: string; events: NodeHistoryEntry[] }>(
    enabled ? withBasePath(`/api/node-history?node=${encodeURIComponent(nodeName)}&days=${DAYS}`) : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  if (!enabled) return null;

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data?.now) return null;

  const events = data?.events ?? [];
  // Server time of the response, so the strip lines up with the data
  const now = data?.now ? new Date(data.now).getTime() : 0;
  const windowStart = now - DAYS * DAY_MS;
  const unavailableMs = events.reduce((total, e) => {
    const start = Math.max(new Date(e.startedAt).getTime(), windowStart);
    const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
    return total + Math.max(0, end - start);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Availability, last {DAYS} days</h3>
        <span className="text-xs text-muted-foreground">
          {events.length === 0
            ? "No drain or down periods recorded"
            : `Unavailable ${formatDistanceStrict(0, unavailableMs)} (${((unavailableMs / (DAYS * DAY_MS)) * 100).toFixed(1)}%)`}
        </span>
      </div>

      <div className="relative h-3 w-full rounded bg-emerald-500/20 overflow-hidden" aria-hidden>
        {events.map((e, i) => {
          const start = Math.max(new Date(e.startedAt).getTime(), windowStart);
          const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
          const left = ((start - windowStart) / (DAYS * DAY_MS)) * 100;
          const width = Math.max(((end - start) / (DAYS * DAY_MS)) * 100, 0.3);
          return (
            <div
              key={i}
              className={`absolute top-0 h-full ${stateColor(e.state)}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${e.state}: ${e.reason ?? "no reason"}`}
            />
          );
        })}
      </div>

      {events.length > 0 && (
        <div className="max-h-28 overflow-y-auto rounded-md border divide-y text-xs">
          {events.map((e, i) => {
            const start = new Date(e.startedAt);
            const end = e.endedAt ? new Date(e.endedAt) : null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${stateColor(e.state)}`} />
                  {e.state}
                </Badge>
                <span className="min-w-0 flex-1 truncate" title={e.reason ?? undefined}>
                  {e.reason || "No reason given"}
                  {e.setBy && <span className="text-muted-foreground"> · {e.setBy}</span>}
                </span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {format(start, "MMM d, HH:mm")} → {end ? format(end, "MMM d, HH:mm") : "now"} (
                  {formatDistanceStrict(start, end ?? new Date(now))})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
