"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, formatDistanceStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeature } from "@/components/runtime-config";
import { withBasePath } from "@/lib/base-path";
import { getColorSchema } from "@/lib/color-schemas";
import { NODE_STATES, type NodeHistoryEntry, type NodeState, type NodeStateHour } from "@/lib/node-history";

const DAYS = 30;
const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = DAYS * 24 * HOUR_MS;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LABELS: Record<NodeState, string> = {
  down: "Down",
  maintenance: "Maintenance",
  drained: "Drained",
  draining: "Draining",
  powered_down: "Powered down",
  reserved: "Reserved",
  allocated: "Full",
  mixed: "Partial",
  idle: "Idle",
  other: "Other",
};

// States that win an hour even when they only covered part of it, so a short
// outage doesn't disappear behind the rest of the hour
const PROBLEM_STATES: NodeState[] = ["down", "maintenance", "drained", "draining"];
const PROBLEM_SHARE = 0.1;

// Colors come from the node cards' color scheme. The schemes use one color
// for drain and down, so down is hatched and draining striped with partial.
function stateColors(schemaName: string): Record<NodeState, string> {
  const card = getColorSchema(schemaName).progressColors;
  return {
    down: `repeating-linear-gradient(135deg, ${card.down} 0 3px, rgba(0,0,0,.55) 3px 6px)`,
    maintenance: "#78716c",
    drained: card.drain,
    draining: `repeating-linear-gradient(135deg, ${card.drain} 0 3px, ${card.mixed} 3px 6px)`,
    powered_down: "#52525b",
    reserved: "#3730a3",
    allocated: card.allocated,
    mixed: card.mixed,
    idle: card.idle,
    other: "#71717a",
  };
}

function hourState(seconds: NodeStateHour["seconds"]): NodeState {
  const total = Object.values(seconds).reduce((a, b) => a + (b ?? 0), 0);
  const problem = PROBLEM_STATES.find((s) => (seconds[s] ?? 0) >= total * PROBLEM_SHARE);
  if (problem) return problem;
  return (Object.entries(seconds) as [NodeState, number][]).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function eventState(state: string): NodeState {
  if (/DOWN|FAIL|ERROR|NOT_RESPONDING|INVALID_REG/.test(state)) return "down";
  if (state.includes("DRAIN")) return "drained";
  return "maintenance";
}

function duration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
}

// A node's states over the last 30 days, and when and why it was drained or down
export function NodeHistoryPanel({ nodeName }: { nodeName: string }) {
  const enabled = useFeature("nodeHistory");
  const { data, isLoading } = useSWR<{ enabled: boolean; now?: string; events: NodeHistoryEntry[]; hours?: NodeStateHour[] }>(
    enabled ? withBasePath(`/api/node-history?node=${encodeURIComponent(nodeName)}&days=${DAYS}`) : null,
    fetcher,
    { refreshInterval: 60000 }
  );
  const [colors] = useState(() => {
    let schema = "default";
    try {
      schema = localStorage.getItem("colorSchema") || "default";
    } catch {}
    return stateColors(schema);
  });
  const [hovered, setHovered] = useState<NodeStateHour | null>(null);

  if (!enabled) return null;

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data?.now) return null;

  const events = data.events ?? [];
  const hours = data.hours ?? [];
  // Server time of the response, so the bar lines up with the data
  const now = new Date(data.now).getTime();
  const windowStart = now - WINDOW_MS;

  const totals: Partial<Record<NodeState, number>> = {};
  for (const h of hours) {
    for (const [state, s] of Object.entries(h.seconds) as [NodeState, number][]) {
      totals[state] = (totals[state] ?? 0) + s;
    }
  }
  const recorded = Object.values(totals).reduce((a, b) => a + (b ?? 0), 0);
  const firstHour = hours.length ? new Date(hours[0].hour).getTime() : now;

  const position = (t: number) => ((Math.max(t, windowStart) - windowStart) / WINDOW_MS) * 100;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-medium text-muted-foreground">Node history, last {DAYS} days</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {hovered ? (
            <>
              <span className="text-foreground">{format(new Date(hovered.hour), "MMM d, HH:00")}</span>{" "}
              {(Object.entries(hovered.seconds) as [NodeState, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([s, sec]) => `${LABELS[s]} ${duration(sec)}`)
                .join(" · ")}
            </>
          ) : hours.length === 0 ? (
            "Recording started; the bar fills in as the dashboard checks this node"
          ) : firstHour > windowStart + 24 * HOUR_MS ? (
            `Recorded since ${format(new Date(firstHour), "MMM d")}`
          ) : null}
        </span>
      </div>

      <div className="relative h-5 w-full overflow-hidden rounded-md bg-muted" onMouseLeave={() => setHovered(null)}>
        {hours.map((h) => {
          const start = new Date(h.hour).getTime();
          if (start + HOUR_MS <= windowStart) return null;
          const left = position(start);
          const width = position(Math.min(start + HOUR_MS, now)) - left;
          return (
            <div
              key={h.hour}
              className="absolute top-0 h-full hover:brightness-125"
              style={{ left: `${left}%`, width: `${width}%`, background: colors[hourState(h.seconds)] }}
              onMouseEnter={() => setHovered(h)}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{format(new Date(windowStart), "MMM d")}</span>
        <span>{format(new Date(windowStart + WINDOW_MS / 2), "MMM d")}</span>
        <span>Now</span>
      </div>

      {recorded > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {NODE_STATES.filter((s) => totals[s]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[s] }} />
              {LABELS[s]}
              <span className="text-muted-foreground tabular-nums">{(((totals[s] ?? 0) / recorded) * 100).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="max-h-28 overflow-y-auto rounded-md border divide-y text-xs">
          {events.map((e, i) => {
            const start = new Date(e.startedAt);
            const end = e.endedAt ? new Date(e.endedAt) : null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colors[eventState(e.state)] }} />
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
