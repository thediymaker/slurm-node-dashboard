"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { NodeGroups, type GroupBy } from "@/components/nodeCard/node-grid";
import { Segmented } from "@/components/nodeCard/node-toolbar";
import { STATE_LABELS, STATE_ORDER, stateColors, stateOf, type CardSize } from "@/components/nodeCard/node-view";
import { useColorSchema } from "@/components/use-color-schema";
import type { NodeState } from "@/lib/node-history";
import type { HistoricalNode } from "@/types/types";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

const DAYS = 7;
const BUSY: NodeState[] = ["allocated", "mixed", "draining"];

interface TimelineHour {
  hour: string;
  snapshot: boolean;
  seconds: Partial<Record<NodeState, number>> | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't load Rewind data.");
  }
  return res.json();
};

// Share of node time spent busy in an hour, from node history
function busyShare(seconds: TimelineHour["seconds"]): number | null {
  if (!seconds) return null;
  let busy = 0;
  let total = 0;
  for (const [state, s] of Object.entries(seconds)) {
    total += s ?? 0;
    if (BUSY.includes(state as NodeState)) busy += s ?? 0;
  }
  return total > 0 ? busy / total : null;
}

function endOfDay(day: Date): Date {
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return end.getTime() > Date.now() ? new Date() : end;
}

const DashboardHistory = () => {
  const [colorSchema] = useColorSchema();
  // The timeline shows the week ending here; undefined follows "now"
  const [windowEnd, setWindowEnd] = useState<Date | undefined>(undefined);
  // The chosen hour; undefined means the latest snapshot in the window
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [size, setSize] = useState<CardSize>(100);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const timelineUrl = withBasePath(
    `/api/rewind/timeline?days=${DAYS}${windowEnd ? `&end=${encodeURIComponent(windowEnd.toISOString())}` : ""}`
  );
  const { data: timeline, error: timelineError } = useSWR<{ hours: TimelineHour[] }>(timelineUrl, fetcher, {
    refreshInterval: windowEnd ? 0 : 5 * 60 * 1000,
  });
  const hours = useMemo(() => timeline?.hours ?? [], [timeline]);
  const snapshotTimes = useMemo(() => hours.filter((h) => h.snapshot).map((h) => Date.parse(h.hour)), [hours]);

  const selected = picked ?? snapshotTimes[snapshotTimes.length - 1];
  const index = selected === undefined ? -1 : snapshotTimes.indexOf(selected);

  const { data: snapshot, error: snapshotError, isLoading: snapshotLoading } = useSWR<{ nodes: HistoricalNode[] }>(
    selected !== undefined ? withBasePath(`/api/rewind?at=${encodeURIComponent(new Date(selected).toISOString())}`) : null,
    fetcher,
    { keepPreviousData: true }
  );
  const nodes = useMemo(() => snapshot?.nodes ?? [], [snapshot]);

  const step = (delta: number) => {
    const next = snapshotTimes[index + delta];
    if (next !== undefined) setPicked(next);
  };

  // Play steps forward through the snapshots and stops at the newest
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPicked((current) => {
        const at = snapshotTimes.indexOf(current ?? snapshotTimes[snapshotTimes.length - 1]);
        if (at < 0 || at >= snapshotTimes.length - 1) {
          setPlaying(false);
          return current;
        }
        return snapshotTimes[at + 1];
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [playing, snapshotTimes]);

  const counts = useMemo(() => {
    const map = new Map<NodeState, number>();
    for (const node of nodes) map.set(stateOf(node), (map.get(stateOf(node)) ?? 0) + 1);
    return map;
  }, [nodes]);
  const colors = stateColors(colorSchema);

  // Day labels under the timeline, one per local day
  const dayLabels = useMemo(() => {
    const seen = new Map<string, number>();
    hours.forEach((h, i) => {
      const label = format(new Date(h.hour), "EEE d");
      if (!seen.has(label)) seen.set(label, i);
    });
    return [...seen.entries()];
  }, [hours]);

  const noSnapshots = timeline && snapshotTimes.length === 0;

  return (
    <div className="mb-20 flex flex-col gap-4" aria-label="Rewind">
      <section aria-label="Timeline" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xl font-semibold tabular-nums">
              {selected !== undefined ? format(new Date(selected), "EEE MMM d, HH:mm") : "No snapshot selected"}
            </span>
            <span className="text-xs text-muted-foreground">
              {selected !== undefined
                ? `${formatDistanceToNow(new Date(selected), { addSuffix: true })} · hourly snapshot`
                : noSnapshots
                  ? "No snapshots in this week"
                  : "Loading snapshots…"}
            </span>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous snapshot" disabled={index <= 0} onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label={playing ? "Pause" : "Play"}
            disabled={snapshotTimes.length < 2}
            onClick={() => {
              // Playing from the newest snapshot starts at the beginning of the week
              if (!playing && index === snapshotTimes.length - 1) setPicked(snapshotTimes[0]);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next snapshot"
            disabled={index < 0 || index >= snapshotTimes.length - 1}
            onClick={() => step(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 text-[13px] font-normal">
                <CalendarDays className="h-3.5 w-3.5" />
                Pick a date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selected !== undefined ? new Date(selected) : undefined}
                disabled={{ after: new Date() }}
                onSelect={(day) => {
                  if (!day) return;
                  setPlaying(false);
                  setWindowEnd(endOfDay(day));
                  setPicked(undefined);
                  setCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[13px] font-normal"
            onClick={() => {
              setPlaying(false);
              setWindowEnd(undefined);
              setPicked(undefined);
            }}
          >
            Now
          </Button>
        </div>

        {timeline ? (
          <>
            <div
              className="flex h-16 items-end gap-px border-b"
              role="group"
              aria-label={`Busy node time per hour over ${DAYS} days; pick an hour with a snapshot`}
            >
              {hours.map((h) => {
                const t = Date.parse(h.hour);
                const share = busyShare(h.seconds);
                const isSelected = t === selected;
                const label = `${format(new Date(t), "EEE MMM d, HH:mm")}${share !== null ? `, ${Math.round(share * 100)}% busy` : ""}${h.snapshot ? "" : ", no snapshot"}`;
                return (
                  <button
                    key={h.hour}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={isSelected}
                    disabled={!h.snapshot}
                    onClick={() => {
                      setPlaying(false);
                      setPicked(t);
                    }}
                    className="group flex h-full min-w-0 flex-1 items-end disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "w-full rounded-t-[1px] transition-colors",
                        isSelected
                          ? "bg-foreground"
                          : h.snapshot
                            ? "bg-muted-foreground/50 group-hover:bg-muted-foreground"
                            : "bg-muted-foreground/15"
                      )}
                      style={{ height: `${Math.max(6, Math.round((share ?? (h.snapshot ? 0.5 : 0.1)) * 100))}%` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="relative h-3 font-mono text-[10px] text-muted-foreground">
              {dayLabels.map(([label, i]) => (
                <span key={label} className="absolute whitespace-nowrap" style={{ left: `${(i / hours.length) * 100}%` }}>
                  {label}
                </span>
              ))}
            </div>
          </>
        ) : timelineError ? (
          <p className="text-sm text-destructive">{timelineError.message}</p>
        ) : (
          <Skeleton className="h-20 w-full" />
        )}
      </section>

      {nodes.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="flex flex-col gap-1 rounded-lg border bg-card px-3.5 py-3">
            <span className="text-xs text-muted-foreground">Nodes</span>
            <span className="text-xl font-semibold tabular-nums">{nodes.length}</span>
          </div>
          {STATE_ORDER.filter((s) => counts.has(s)).map((s) => (
            <div key={s} className="flex flex-col gap-1 rounded-lg border bg-card px-3.5 py-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: colors[s] }} />
                {STATE_LABELS[s]}
              </span>
              <span className="text-xl font-semibold tabular-nums">{counts.get(s)}</span>
            </div>
          ))}
        </div>
      )}

      {nodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Group by"
            value={groupBy}
            options={[
              { value: "partition" as GroupBy, label: "Partition" },
              { value: "state" as GroupBy, label: "State" },
              { value: "none" as GroupBy, label: "None" },
            ]}
            onChange={setGroupBy}
          />
          <div className="flex-1" />
          <Segmented
            label="Size"
            value={size}
            options={[
              { value: 50 as CardSize, label: "S" },
              { value: 100 as CardSize, label: "M" },
            ]}
            onChange={setSize}
          />
        </div>
      )}

      {snapshotError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {snapshotError.message}
        </div>
      ) : nodes.length > 0 ? (
        <div className={cn("transition-opacity", snapshotLoading && "opacity-60")}>
          <NodeGroups nodes={nodes} groupBy={groupBy} size={size} colorSchema={colorSchema} historical />
        </div>
      ) : noSnapshots ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No snapshots were saved in this week. Pick another date, or check that Rewind is collecting under Admin → Plugins.
        </div>
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
          {Array.from({ length: 24 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-[9px]" />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardHistory;
