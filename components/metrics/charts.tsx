"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/metrics/params";
import { bucketLabel } from "@/components/metrics/format";

// Charts for the metrics tabs. Stacked time series use Recharts; small
// histograms and ranked bars are plain elements, which keeps them crisp and
// easy to label. Colors come from theme tokens only.

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export function Legend({
  items,
  onClick,
}: {
  items: { label: string; color: string; key?: string }[];
  onClick?: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((s) => {
        const content = (
          <>
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="truncate max-w-[12rem]">{s.label}</span>
          </>
        );
        return onClick && s.key ? (
          <button
            key={s.label}
            type="button"
            onClick={() => onClick(s.key!)}
            className="inline-flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground hover:underline"
          >
            {content}
          </button>
        ) : (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
            {content}
          </span>
        );
      })}
    </div>
  );
}

interface TooltipRow {
  label: string;
  color: string;
  value: string;
}

function TooltipBox({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: string }) {
  return (
    <div className="rounded-lg border bg-popover text-popover-foreground px-3 py-2 text-xs shadow-md min-w-[10rem]">
      <div className="font-medium mb-1">{title}</div>
      <div className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: r.color }} />
            <span className="flex-1 truncate max-w-[14rem] text-muted-foreground">{r.label}</span>
            <span className="tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1 pt-1 border-t text-muted-foreground tabular-nums">{footer}</div>}
    </div>
  );
}

// Stacked bars over time, one stack per period bucket
export function StackedTimeChart({
  buckets,
  period,
  series,
  format,
  height = 220,
  stacked = true,
  onSeriesClick,
  totalLabel = "Total",
}: {
  buckets: string[];
  period: Period;
  series: ChartSeries[];
  format: (v: number | null) => string;
  height?: number;
  stacked?: boolean;
  onSeriesClick?: (key: string) => void;
  totalLabel?: string;
}) {
  const data = buckets.map((b, i) => {
    const row: Record<string, string | number | null> = { bucket: b };
    series.forEach((s, j) => (row[`s${j}`] = s.values[i]));
    return row;
  });
  return (
    <ChartContainer config={{}} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={buckets.length > 60 ? 1 : "18%"}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          minTickGap={24}
          tickFormatter={(v: string) => bucketLabel(v, period)}
        />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => format(v)} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          content={({ active, label }) => {
            if (!active || typeof label !== "string") return null;
            const i = buckets.indexOf(label);
            if (i === -1) return null;
            const rows = series
              .map((s) => ({ label: s.label, color: s.color, raw: s.values[i] }))
              .filter((r) => r.raw !== null && r.raw !== 0);
            const total = rows.reduce((sum, r) => sum + (r.raw ?? 0), 0);
            return (
              <TooltipBox
                title={bucketLabel(label, period, true)}
                rows={rows.map((r) => ({ label: r.label, color: r.color, value: format(r.raw) }))}
                footer={stacked && rows.length > 1 ? `${totalLabel}: ${format(total)}` : undefined}
              />
            );
          }}
        />
        {series.map((s, j) => (
          <Bar
            key={s.key}
            dataKey={`s${j}`}
            name={s.label}
            stackId={stacked ? "a" : undefined}
            fill={s.color}
            stroke="hsl(var(--card))"
            strokeWidth={stacked ? 1 : 0}
            radius={!stacked || j === series.length - 1 ? [3, 3, 0, 0] : 0}
            isAnimationActive={false}
            onClick={onSeriesClick ? () => onSeriesClick(s.key) : undefined}
            className={onSeriesClick ? "cursor-pointer" : undefined}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export interface UtilizationPoint {
  bucket: string;
  allocated: number | null; // share of total, 0-1
  idle: number | null;
  unavailable: number | null;
}

const ALLOCATED_COLOR = "hsl(var(--chart-1))";
const IDLE_COLOR = "hsl(var(--muted))";
const UNAVAILABLE_COLOR = "hsl(var(--muted-foreground))";

export function UtilizationLegend({ nodes = false }: { nodes?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/80">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ALLOCATED_COLOR }} />
        {nodes ? "Running jobs" : "Allocated"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border" style={{ background: IDLE_COLOR }} />
        Idle
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ background: `repeating-linear-gradient(135deg, ${UNAVAILABLE_COLOR} 0 1.5px, transparent 1.5px 3.5px)` }}
        />
        Unavailable (drained, down)
      </span>
    </div>
  );
}

// Allocated, idle and unavailable cores, GPUs or nodes as shares of the
// cluster, per bucket
export function UtilizationChart({
  points,
  period,
  nodes = false,
  height = 220,
}: {
  points: UtilizationPoint[];
  period: Period;
  nodes?: boolean;
  height?: number;
}) {
  const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);
  return (
    <ChartContainer config={{}} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={points.length > 60 ? 1 : "18%"}>
        <defs>
          <pattern id="metrics-unavailable" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="hsl(var(--card))" />
            <line x1="0" y1="0" x2="0" y2="4" stroke={UNAVAILABLE_COLOR} strokeWidth="1.5" />
          </pattern>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          minTickGap={24}
          tickFormatter={(v: string) => bucketLabel(v, period)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={(v: number) => `${v * 100}%`}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as UtilizationPoint | undefined) : undefined;
            if (!p) return null;
            if (p.allocated === null)
              return <TooltipBox title={bucketLabel(p.bucket, period, true)} rows={[]} footer="No capacity recorded" />;
            return (
              <TooltipBox
                title={bucketLabel(p.bucket, period, true)}
                rows={[
                  { label: nodes ? "Running jobs" : "Allocated", color: ALLOCATED_COLOR, value: pct(p.allocated) },
                  { label: "Idle", color: IDLE_COLOR, value: pct(p.idle) },
                  { label: "Unavailable", color: UNAVAILABLE_COLOR, value: pct(p.unavailable) },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="allocated"
          stackId="u"
          fill={ALLOCATED_COLOR}
          stroke="hsl(var(--card))"
          strokeWidth={1}
          isAnimationActive={false}
        />
        <Bar dataKey="idle" stackId="u" fill={IDLE_COLOR} stroke="hsl(var(--card))" strokeWidth={1} isAnimationActive={false} />
        <Bar
          dataKey="unavailable"
          stackId="u"
          fill="url(#metrics-unavailable)"
          stroke="hsl(var(--card))"
          strokeWidth={1}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

export interface HistogramBin {
  label: string;
  value: number;
  display: string; // the value as shown above the bar
  title?: string;
}

// Vertical bars with their values above and labels below
export function ColumnHistogram({
  bins,
  color,
  height = 140,
  showValues = true,
}: {
  bins: HistogramBin[];
  color: string;
  height?: number;
  showValues?: boolean;
}) {
  const max = Math.max(...bins.map((b) => b.value), 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {bins.map((b) => (
          <div
            key={b.label}
            className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1"
            title={b.title ?? `${b.label}: ${b.display}`}
          >
            {showValues && (
              <span className="text-[11px] text-muted-foreground tabular-nums truncate max-w-full">{b.display}</span>
            )}
            <span
              className="block w-full rounded-t-[3px]"
              style={{
                background: color,
                height: max > 0 ? `${Math.max(b.value > 0 ? 2 : 0, (b.value / max) * (height - (showValues ? 20 : 0)))}px` : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {bins.map((b) => (
          <span key={b.label} className="flex-1 min-w-0 text-center font-mono text-[10px] text-muted-foreground truncate">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Name, bar and value per row, longest bar first
export function RankedBars({
  rows,
  color = "hsl(var(--chart-1))",
  onClick,
}: {
  rows: { key: string; label: string; value: number; display: string }[];
  color?: string;
  onClick?: (key: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="truncate text-left">{r.label}</span>
            <span className="h-2 rounded-full bg-muted overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{ background: color, width: max > 0 ? `${(r.value / max) * 100}%` : 0 }}
              />
            </span>
            <span className="text-right text-muted-foreground tabular-nums">{r.display}</span>
          </>
        );
        const cls = "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] gap-3 items-center text-sm";
        return onClick ? (
          <button
            key={r.key}
            type="button"
            className={cn(cls, "hover:bg-muted/50 rounded -mx-1 px-1")}
            onClick={() => onClick(r.key)}
          >
            {inner}
          </button>
        ) : (
          <div key={r.key} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// A row of tiny bars for a table cell
export function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  // At most ~24 bars: longer series are summed into groups
  const step = Math.max(1, Math.ceil(values.length / 24));
  const grouped: number[] = [];
  for (let i = 0; i < values.length; i += step) {
    grouped.push(values.slice(i, i + step).reduce<number>((s, v) => s + (v ?? 0), 0) / step);
  }
  const max = Math.max(...grouped, 0);
  return (
    <span className="flex items-end gap-px h-[18px]" aria-hidden>
      {grouped.map((v, i) => (
        <span
          key={i}
          className="w-1 rounded-[1px]"
          style={{ background: color, height: max > 0 ? `${Math.max(1, (v / max) * 18)}px` : "1px", opacity: max > 0 ? 1 : 0.3 }}
        />
      ))}
    </span>
  );
}
