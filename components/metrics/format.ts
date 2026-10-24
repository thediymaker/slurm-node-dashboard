import type { ExplorerMetric, Period } from "@/lib/metrics/params";

// Formatting and CSV helpers shared by the metrics tabs

// Series colors in a fixed order (theme tokens; the second blue goes last
// because it sits closest to the first). "Other" is always the muted gray.
export const SERIES_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-2))",
];
export const OTHER_COLOR = "hsl(var(--muted-foreground) / 0.45)";

// Colors are never reused: past the fifth series everything is gray. Ordered
// groups (job size, wall time) get one hue from light to dark instead.
export function seriesColor(index: number, other = false, ordinal?: { count: number }): string {
  if (other) return OTHER_COLOR;
  if (ordinal) {
    const t = ordinal.count > 1 ? index / (ordinal.count - 1) : 1;
    return `hsl(var(--chart-1) / ${(0.3 + 0.7 * t).toFixed(2)})`;
  }
  return SERIES_COLORS[index] ?? OTHER_COLOR;
}

// 1.92M, 41.3k, 312, 4.5
export function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${Math.round(value / 1e3)}k`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  if (abs >= 100 || Number.isInteger(value)) return Math.round(value).toLocaleString();
  return value.toFixed(1);
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString();
}

// 42s, 6.4 min, 2.1 h, 3.2 d
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

// 6h 41m, 22m, 35s
export function fmtClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// ratio is 0-1
export function fmtPct(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

// Change against the previous range: "+8%", or for rates "+3 pt"
export function fmtChange(
  current: number | null,
  previous: number | null,
  kind: "relative" | "points" = "relative"
): string | null {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (kind === "points") {
    const d = current - previous;
    if (Math.abs(d) < 0.05) return "no change";
    return `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)} pt`;
  }
  if (previous === 0) return current === 0 ? "no change" : null;
  const d = ((current - previous) / previous) * 100;
  if (Math.abs(d) < 0.5) return "no change";
  return `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A bucket key (YYYY-MM-DD of its first day) as a label for its period
export function bucketLabel(key: string, period: Period, long = false): string {
  const [y, m, d] = key.split("-").map(Number);
  const mon = MONTHS[m - 1] ?? "";
  switch (period) {
    case "day":
      return long ? `${mon} ${d}, ${y}` : `${mon} ${d}`;
    case "week":
      return long ? `Week of ${mon} ${d}, ${y}` : `${mon} ${d}`;
    case "month":
      return `${mon} ${y}`;
    case "quarter":
      return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    case "year":
      return String(y);
  }
}

export const PERIOD_NOUN: Record<Period, string> = {
  day: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  year: "year",
};

// How each Explorer metric reads
export const METRIC_FORMAT: Record<ExplorerMetric, (v: number | null) => string> = {
  cpuHours: fmtNum,
  gpuHours: fmtNum,
  nodeHours: fmtNum,
  jobs: fmtInt,
  avgWait: (v) => (v === null ? "—" : fmtDuration(v * 60)),
  avgSize: (v) => (v === null ? "—" : `${v.toFixed(1)} cores`),
  avgWall: (v) => (v === null ? "—" : fmtDuration(v * 3600)),
  users: fmtInt,
  utilization: (v) => (v === null ? "—" : `${v.toFixed(1)}%`),
  memEfficiency: (v) => (v === null ? "—" : `${v.toFixed(0)}%`),
  cpuEfficiency: (v) => (v === null ? "—" : `${v.toFixed(0)}%`),
};

// Metrics that are already percentages compare in points
export const METRIC_CHANGE: Record<ExplorerMetric, "relative" | "points"> = {
  cpuHours: "relative",
  gpuHours: "relative",
  nodeHours: "relative",
  jobs: "relative",
  avgWait: "relative",
  avgSize: "relative",
  avgWall: "relative",
  users: "relative",
  utilization: "points",
  memEfficiency: "points",
  cpuEfficiency: "points",
};

export const METRIC_UNIT: Record<ExplorerMetric, string> = {
  cpuHours: "CPU hours",
  gpuHours: "GPU hours",
  nodeHours: "node hours",
  jobs: "jobs",
  avgWait: "minutes",
  avgSize: "cores per job",
  avgWall: "hours",
  users: "users",
  utilization: "% of available cores",
  memEfficiency: "% of requested memory",
  cpuEfficiency: "% of allocated cores",
};

type Cell = string | number | null | undefined;

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(4)) : value;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// "CANCELLED" -> "Cancelled", "OUT_OF_MEMORY" -> "Out of memory"
export function stateLabel(state: string): string {
  const s = state.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Status colors for job states (Tailwind classes, readable in both themes)
export function stateDotClass(state: string): string {
  switch (state) {
    case "COMPLETED":
      return "bg-emerald-500";
    case "FAILED":
    case "NODE_FAIL":
    case "BOOT_FAIL":
      return "bg-red-500";
    case "TIMEOUT":
    case "DEADLINE":
      return "bg-amber-500";
    case "OUT_OF_MEMORY":
      return "bg-violet-500";
    case "PREEMPTED":
      return "bg-sky-500";
    default:
      return "bg-muted-foreground/60";
  }
}
