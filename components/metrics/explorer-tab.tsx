"use client";

import * as React from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHierarchyLabels } from "@/components/runtime-config";
import { cn } from "@/lib/utils";
import {
  EXPLORER_GROUPS,
  EXPLORER_METRICS,
  EXPLORER_VIEWS,
  metricsQuery,
  parseMetricsParams,
  type ExplorerGroup,
  type ExplorerView,
} from "@/lib/metrics/params";
import type { ExplorerResult } from "@/lib/metrics/explorer";
import { useMetricsNav } from "@/components/metrics/metrics-nav";
import { CsvButton, EmptyState, Panel, QuietNote } from "@/components/metrics/panel";
import { Legend, RankedBars, Sparkline, StackedTimeChart } from "@/components/metrics/charts";
import {
  METRIC_CHANGE,
  METRIC_FORMAT,
  METRIC_UNIT,
  PERIOD_NOUN,
  fmtChange,
  fmtPct,
  seriesColor,
  stateLabel,
} from "@/components/metrics/format";

const VIEW_LABELS: Record<ExplorerView, string> = { time: "Over time", totals: "Totals", table: "Table" };

// Saved views are per browser
const SAVED_KEY = "slurmdash.metrics.savedViews";

interface SavedView {
  name: string;
  query: string;
}

// A tiny store over localStorage, so every Saved menu stays in step
const savedListeners = new Set<() => void>();

function subscribeSaved(callback: () => void) {
  savedListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    savedListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function savedSnapshot(): string {
  try {
    return window.localStorage.getItem(SAVED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseSaved(raw: string): SavedView[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v?.name === "string" && typeof v?.query === "string") : [];
  } catch {
    return [];
  }
}

function storeSaved(views: SavedView[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(views));
  } catch {
    // Storage unavailable (private window); the view just isn't kept
  }
  savedListeners.forEach((l) => l());
}

function SavedViews() {
  const { params, navigate } = useMetricsNav();
  const raw = React.useSyncExternalStore(subscribeSaved, savedSnapshot, () => "[]");
  const views = React.useMemo(() => parseSaved(raw), [raw]);
  const [name, setName] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...views.filter((v) => v.name !== trimmed), { name: trimmed, query: metricsQuery(params) }];
    storeSaved(next);
    setName("");
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Save view
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label htmlFor="metrics-view-name" className="text-xs text-muted-foreground">
              Saves the metric, grouping, filters and range in this browser.
            </label>
            <Input
              id="metrics-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="View name"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Save
            </Button>
          </form>
        </PopoverContent>
      </Popover>
      {views.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Bookmark className="h-3.5 w-3.5 mr-1.5" />
              Saved
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Saved views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {views.map((v) => (
              <DropdownMenuItem
                key={v.name}
                className="flex items-center gap-2"
                onSelect={() => navigate(() => parseMetricsParams(new URLSearchParams(v.query)))}
              >
                <span className="flex-1 truncate">{v.name}</span>
                <button
                  type="button"
                  aria-label={`Delete ${v.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    storeSaved(views.filter((x) => x.name !== v.name));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

export function ExplorerTab({ result }: { result: ExplorerResult }) {
  const { params, period, hierarchy, navigate, fromDate, toDate } = useMetricsNav();
  const { level1, level2 } = useHierarchyLabels();
  const { metric, group, view } = params.explorer;
  const fmt = METRIC_FORMAT[metric];

  const groupLabel = (g: ExplorerGroup) =>
    g === "college" ? level1 : g === "department" ? level2 : EXPLORER_GROUPS.find((x) => x.value === g)!.label;
  const metricLabel = EXPLORER_METRICS.find((m) => m.value === metric)!.label;
  const groups = EXPLORER_GROUPS.filter((g) => hierarchy || (g.value !== "college" && g.value !== "department"));
  const label = (key: string, other: boolean) => (other ? "Other" : group === "state" ? stateLabel(key) : key);
  const ordinal = group === "jobSize" || group === "wallTime" ? { count: result.series.length } : undefined;
  const series = result.series.map((s, i) => ({ ...s, label: label(s.key, s.other), color: seriesColor(i, s.other, ordinal) }));
  const title = `${metricLabel} by ${groupLabel(group).toLowerCase()}`;
  const filename = `${metric}-by-${group}_${fromDate}_${toDate}`;

  const set = (update: Partial<typeof params.explorer>) => navigate((p) => ({ ...p, explorer: { ...p.explorer, ...update } }));

  const csvSeries = () => ({
    filename,
    header: [groupLabel(group).toLowerCase(), "total", "previous_range", "share", ...result.buckets],
    rows: series.map((s) => [s.label, s.total, s.prior, s.share, ...s.values]),
  });

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <aside
        className="flex-[1_1_13rem] max-w-[16rem] rounded-xl border bg-card p-2 flex flex-col gap-3"
        aria-label="Chart settings"
      >
        <OptionList
          label="Metric"
          options={EXPLORER_METRICS.map((m) => ({ value: m.value, label: m.label }))}
          value={metric}
          onPick={(v) => set({ metric: v as typeof metric })}
        />
        <OptionList
          label="Group by"
          options={groups.map((g) => ({ value: g.value, label: groupLabel(g.value) }))}
          value={group}
          onPick={(v) => set({ group: v as ExplorerGroup })}
        />
      </aside>

      <section className="flex-[999_1_40rem] min-w-0 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Chart type" className="flex gap-0.5 rounded-lg border bg-card p-0.5">
            {EXPLORER_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => set({ view: v })}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground",
                  view === v && "bg-muted text-foreground"
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <SavedViews />
          <CsvButton csv={csvSeries} />
        </div>

        {result.unavailable ? (
          <EmptyState>{result.unavailable}</EmptyState>
        ) : series.length === 0 ? (
          <EmptyState>Nothing to show for this range and filters.</EmptyState>
        ) : (
          <>
            {view !== "table" && (
              <Panel
                title={title}
                description={
                  view === "time"
                    ? `per ${PERIOD_NOUN[period]} · ${result.additive ? "stacked, " : ""}top ${series.filter((s) => !s.other).length}${series.some((s) => s.other) ? " and the rest" : ""}`
                    : `${METRIC_UNIT[metric]} for the whole range`
                }
                actions={view === "time" ? <Legend items={series} /> : undefined}
              >
                {view === "time" ? (
                  <StackedTimeChart
                    buckets={result.buckets}
                    period={period}
                    series={series}
                    format={fmt}
                    height={280}
                    stacked={result.additive}
                    totalLabel={metricLabel}
                  />
                ) : (
                  <RankedBars
                    rows={series.map((s) => ({
                      key: s.key || "other",
                      label: s.label,
                      value: s.total ?? 0,
                      display: fmt(s.total),
                    }))}
                  />
                )}
              </Panel>
            )}
            <SeriesTable result={result} series={series} groupName={groupLabel(group)} />
            {metric === "utilization" && (
              <QuietNote>
                Utilization is the group&apos;s allocated core hours over the cores available on the selected clusters, in periods
                with recorded capacity. Grouped by cluster, each cluster is compared with its own capacity; the cluster names the
                history ingestor uses must match Slurm&apos;s.
              </QuietNote>
            )}
            {(metric === "memEfficiency" || metric === "cpuEfficiency") && (
              <QuietNote>Jobs shorter than 1 minute, and jobs without the measurement, are left out.</QuietNote>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function OptionList({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mx-2.5 mb-1.5">{label}</p>
      <div className="flex flex-col">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onPick(o.value)}
            className={cn(
              "text-left px-2.5 py-1.5 rounded-md text-[13px] text-foreground/80 hover:bg-muted/60",
              o.value === value && "bg-muted text-foreground font-medium"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SeriesTable({
  result,
  series,
  groupName,
}: {
  result: ExplorerResult;
  series: (ExplorerResult["series"][number] & { label: string; color: string })[];
  groupName: string;
}) {
  const { params } = useMetricsNav();
  const metric = params.explorer.metric;
  const fmt = METRIC_FORMAT[metric];
  const changeKind = METRIC_CHANGE[metric];
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b">
            <th className="w-6 py-2.5 pl-4" />
            <th className="text-left font-normal py-2.5 pr-3">{groupName}</th>
            <th className="text-right font-normal py-2.5 px-3">Total</th>
            <th className="text-right font-normal py-2.5 px-3">Share</th>
            <th className="text-left font-normal py-2.5 px-3">Trend</th>
            <th className="text-right font-normal py-2.5 pl-3 pr-4">Vs prior</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.key || "__other"} className="border-t first:border-t-0">
              <td className="py-2 pl-4 pr-1">
                <span className="block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              </td>
              <td className="py-2 pr-3 font-mono text-xs max-w-[18rem] truncate">{s.label}</td>
              <td className="py-2 px-3 text-right">{fmt(s.total)}</td>
              <td className="py-2 px-3 text-right text-muted-foreground">{s.share === null ? "—" : fmtPct(s.share, 1)}</td>
              <td className="py-2 px-3">
                <Sparkline values={s.values} color={s.color} />
              </td>
              <td className="py-2 pl-3 pr-4 text-right text-muted-foreground">
                {fmtChange(s.total, s.prior, changeKind) ?? "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t font-medium">
            <td className="py-2 pl-4" />
            <td className="py-2 pr-3">All</td>
            <td className="py-2 px-3 text-right">{fmt(result.total)}</td>
            <td className="py-2 px-3 text-right text-muted-foreground">{result.additive ? "100%" : "—"}</td>
            <td className="py-2 px-3">
              <Sparkline values={result.totals} color="hsl(var(--foreground) / 0.5)" />
            </td>
            <td className="py-2 pl-3 pr-4 text-right text-muted-foreground">
              {fmtChange(result.total, result.prior, changeKind) ?? "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
