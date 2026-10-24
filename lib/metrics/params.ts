// The metrics page's state, kept in the URL so every view can be shared:
// which tab, the filters every tab shares, the period charts are bucketed by,
// and each tab's own settings. Used by the server page and the client
// components, so nothing here touches the database.

export const TABS = ["overview", "explorer", "efficiency", "jobs"] as const;
export type MetricsTab = (typeof TABS)[number];

export const PERIODS = ["day", "week", "month", "quarter", "year"] as const;
export type Period = (typeof PERIODS)[number];

// Rolling ranges ending today; anything else is a custom from/to
export const RANGE_PRESETS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "180d", label: "Last 6 months", days: 182 },
  { value: "365d", label: "Last 12 months", days: 365 },
] as const;
export const DEFAULT_RANGE = "30d";

export const EXPLORER_METRICS = [
  { value: "cpuHours", label: "CPU hours" },
  { value: "gpuHours", label: "GPU hours" },
  { value: "nodeHours", label: "Node hours" },
  { value: "jobs", label: "Jobs" },
  { value: "avgWait", label: "Average wait" },
  { value: "avgSize", label: "Average job size" },
  { value: "avgWall", label: "Average wall time" },
  { value: "users", label: "Active users" },
  { value: "utilization", label: "Utilization" },
  { value: "memEfficiency", label: "Memory efficiency" },
  { value: "cpuEfficiency", label: "CPU efficiency" },
] as const;
export type ExplorerMetric = (typeof EXPLORER_METRICS)[number]["value"];

export const EXPLORER_GROUPS = [
  { value: "account", label: "Account" },
  { value: "user", label: "User" },
  { value: "college", label: "College" },
  { value: "department", label: "Department" },
  { value: "partition", label: "Partition" },
  { value: "qos", label: "QoS" },
  { value: "jobSize", label: "Job size" },
  { value: "wallTime", label: "Wall time" },
  { value: "state", label: "Job state" },
  { value: "cluster", label: "Cluster" },
] as const;
export type ExplorerGroup = (typeof EXPLORER_GROUPS)[number]["value"];

export const EXPLORER_VIEWS = ["time", "totals", "table"] as const;
export type ExplorerView = (typeof EXPLORER_VIEWS)[number];

export interface MetricsFilters {
  range: string; // a RANGE_PRESETS value, or "custom"
  fromDate?: string; // YYYY-MM-DD, custom ranges only
  toDate?: string;
  clusters: string[];
  colleges: string[];
  departments: string[];
  accounts: string[];
  users: string[];
  partitions: string[];
  qos: string[];
}

export interface MetricsParams {
  tab: MetricsTab;
  filters: MetricsFilters;
  // Unset means "pick from the range length"
  period?: Period;
  // Overview: the college whose departments the college chart shows
  drill?: string;
  explorer: { metric: ExplorerMetric; group: ExplorerGroup; view: ExplorerView };
  jobs: { q: string; page: number; job?: string };
}

export const LIST_FILTERS = ["clusters", "colleges", "departments", "accounts", "users", "partitions", "qos"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function getter(raw: RawParams) {
  return (key: string): string | undefined => {
    if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
  };
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const DATE = /^\d{4}-\d{2}-\d{2}/;

export function parseMetricsParams(raw: RawParams): MetricsParams {
  const get = getter(raw);
  const list = (key: string) =>
    (get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  // Older links carry ISO timestamps in from/to; their date part is what
  // counts now
  const fromDate = get("from")?.match(DATE)?.[0];
  const toDate = get("to")?.match(DATE)?.[0];
  const presetValues = RANGE_PRESETS.map((p) => p.value as string);
  const rangeParam = get("range");
  const range = rangeParam && presetValues.includes(rangeParam) ? rangeParam : fromDate && toDate ? "custom" : DEFAULT_RANGE;

  const page = Math.max(1, Math.floor(Number(get("page")) || 1));

  return {
    tab: oneOf(get("tab"), TABS, "overview"),
    filters: {
      range,
      fromDate: range === "custom" ? (fromDate! <= toDate! ? fromDate : toDate) : undefined,
      toDate: range === "custom" ? (fromDate! <= toDate! ? toDate : fromDate) : undefined,
      clusters: list("clusters"),
      colleges: list("colleges"),
      departments: list("departments"),
      accounts: list("accounts"),
      users: list("users"),
      partitions: list("partitions"),
      qos: list("qos"),
    },
    period: get("period") ? oneOf(get("period"), PERIODS, "day") : undefined,
    drill: get("drill") || undefined,
    explorer: {
      metric: oneOf(
        get("metric"),
        EXPLORER_METRICS.map((m) => m.value),
        "cpuHours"
      ),
      group: oneOf(
        get("group"),
        EXPLORER_GROUPS.map((g) => g.value),
        "account"
      ),
      view: oneOf(get("view"), EXPLORER_VIEWS, "time"),
    },
    jobs: { q: get("q") ?? "", page, job: get("job") || undefined },
  };
}

// The query string for params, leaving out defaults so links stay short
export function metricsQuery(params: MetricsParams): string {
  const q = new URLSearchParams();
  const f = params.filters;
  if (params.tab !== "overview") q.set("tab", params.tab);
  if (f.range === "custom" && f.fromDate && f.toDate) {
    q.set("from", f.fromDate);
    q.set("to", f.toDate);
  } else if (f.range !== DEFAULT_RANGE) {
    q.set("range", f.range);
  }
  for (const key of LIST_FILTERS) if (f[key].length) q.set(key, f[key].join(","));
  if (params.period) q.set("period", params.period);
  if (params.tab === "overview" && params.drill) q.set("drill", params.drill);
  if (params.tab === "explorer") {
    if (params.explorer.metric !== "cpuHours") q.set("metric", params.explorer.metric);
    if (params.explorer.group !== "account") q.set("group", params.explorer.group);
    if (params.explorer.view !== "time") q.set("view", params.explorer.view);
  }
  if (params.tab === "jobs") {
    if (params.jobs.q) q.set("q", params.jobs.q);
    if (params.jobs.page > 1) q.set("page", String(params.jobs.page));
    if (params.jobs.job) q.set("job", params.jobs.job);
  }
  return q.toString();
}

export function rangeDays(filters: MetricsFilters): number {
  if (filters.range === "custom" && filters.fromDate && filters.toDate) {
    const ms = Date.parse(filters.toDate) - Date.parse(filters.fromDate);
    return Math.round(ms / 86_400_000) + 1;
  }
  return RANGE_PRESETS.find((p) => p.value === filters.range)?.days ?? 30;
}

// The period used when none is picked: about 7 to 90 bars
export function defaultPeriod(filters: MetricsFilters): Period {
  const days = rangeDays(filters);
  if (days <= 62) return "day";
  if (days <= 366) return "week";
  if (days <= 3 * 366) return "month";
  return "quarter";
}

export function hasListFilters(filters: MetricsFilters, except: ListFilter[] = []): boolean {
  return LIST_FILTERS.some((key) => !except.includes(key) && filters[key].length > 0);
}
