import { getEfficiencyHistograms, getEfficiencyKpis, getUserEfficiency } from "@/lib/metrics/efficiency";
import type { EfficiencyHistograms, EfficiencyKpis, UserEfficiencyRow } from "@/lib/metrics/efficiency";
import { runExplorer, type ExplorerResult } from "@/lib/metrics/explorer";
import { getJobDetail, searchJobs, type JobDetail, type JobSearchResult } from "@/lib/metrics/jobs";
import {
  getGpuByPartition,
  getOutcomes,
  getOverviewKpis,
  getQueueWait,
  getTopAccounts,
  getUtilization,
  getWallTimeUsed,
} from "@/lib/metrics/overview";
import type {
  AccountRow,
  GpuPartitionRow,
  OverviewKpis,
  Outcomes,
  QueueWaitRow,
  Utilization,
  WallTimeUsed,
} from "@/lib/metrics/overview";
import { RANGE_PRESETS, defaultPeriod, type MetricsParams, type Period } from "@/lib/metrics/params";
import { addDays, resolveRange, todayIn, type MetricsContext, type MetricsRange, type Queryable } from "@/lib/metrics/sql";

// Everything a metrics tab shows, fetched in parallel on the server. A panel
// whose query fails comes back empty (and is logged) instead of failing the
// page.

export interface OverviewData {
  kpis: { current: OverviewKpis; previous: OverviewKpis };
  utilization: Utilization;
  previousUtilization: number | null;
  // null when no accounts are mapped to the hierarchy
  colleges: ExplorerResult | null;
  departments: ExplorerResult | null;
  accounts: AccountRow[];
  jobSize: ExplorerResult;
  wallTime: WallTimeUsed;
  queueWait: QueueWaitRow[];
  outcomes: Outcomes;
  gpu: GpuPartitionRow[];
}

export interface EfficiencyData {
  kpis: EfficiencyKpis;
  histograms: EfficiencyHistograms;
  users: UserEfficiencyRow[];
}

export interface JobsData {
  search: JobSearchResult;
  detail: JobDetail | null;
}

export type TabData =
  | { tab: "overview"; overview: OverviewData }
  | { tab: "explorer"; explorer: ExplorerResult }
  | { tab: "efficiency"; efficiency: EfficiencyData }
  | { tab: "jobs"; jobs: JobsData };

export interface MetricsPageData {
  range: MetricsRange;
  period: Period;
  data: TabData;
}

export interface LoadOptions {
  timeZone: string;
  totalCpu: boolean;
  gpuHistory: boolean;
  capacity: boolean;
  hierarchy: boolean;
}

async function safe<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error(`[metrics] ${label}:`, (err as Error).message);
    return fallback;
  }
}

function emptyExplorer(params: Pick<ExplorerResult, "metric" | "group" | "buckets">): ExplorerResult {
  return { ...params, additive: true, series: [], total: null, prior: null, totals: params.buckets.map(() => null) };
}

export async function loadMetricsPage(db: Queryable, params: MetricsParams, opts: LoadOptions): Promise<MetricsPageData> {
  const f = params.filters;
  const today = todayIn(opts.timeZone);
  const preset = RANGE_PRESETS.find((r) => r.value === f.range);
  const fromDate = f.range === "custom" && f.fromDate ? f.fromDate : addDays(today, -((preset?.days ?? 30) - 1));
  const toDate = f.range === "custom" && f.toDate ? f.toDate : today;
  const period = params.period ?? defaultPeriod(f);
  const range = await resolveRange(db, fromDate, toDate, period, opts.timeZone);

  const ctx: MetricsContext = {
    filters: f,
    range,
    period,
    timeZone: opts.timeZone,
    totalCpu: opts.totalCpu,
    gpuHistory: opts.gpuHistory,
    capacity: opts.capacity,
  };
  const explorer = (metric: ExplorerResult["metric"], group: ExplorerResult["group"], topN: number, filters = f) =>
    safe(
      `${metric} by ${group}`,
      runExplorer(db, ctx, { metric, group, topN, filters }),
      emptyExplorer({ metric, group, buckets: range.buckets })
    );

  let data: TabData;
  switch (params.tab) {
    case "overview": {
      const emptyKpis: OverviewKpis = {
        cpuHours: 0,
        gpuHours: 0,
        nodeHours: 0,
        jobs: 0,
        users: 0,
        accounts: 0,
        medianWaitSeconds: null,
      };
      const noUtil: Utilization = { buckets: [], percent: null, since: null };
      const drill = params.drill && opts.hierarchy ? params.drill : undefined;
      const [kpis, utilization, previous, colleges, departments, accounts, jobSize, wallTime, queueWait, outcomes, gpu] =
        await Promise.all([
          safe("KPIs", getOverviewKpis(db, ctx), { current: emptyKpis, previous: emptyKpis }),
          safe("utilization", getUtilization(db, ctx, "current"), noUtil),
          safe("previous utilization", getUtilization(db, ctx, "previous"), noUtil),
          opts.hierarchy
            ? drill
              ? explorer("cpuHours", "department", 5, { ...f, colleges: [drill] })
              : explorer("cpuHours", "college", 5)
            : null,
          opts.hierarchy ? explorer("cpuHours", "department", 10) : null,
          safe("top accounts", getTopAccounts(db, ctx), []),
          explorer("cpuHours", "jobSize", 6),
          safe("wall time used", getWallTimeUsed(db, ctx), { counts: [], median: null }),
          safe("queue wait", getQueueWait(db, ctx), []),
          safe("outcomes", getOutcomes(db, ctx), { states: [], failedShare: null }),
          safe("GPU by partition", getGpuByPartition(db, ctx), []),
        ]);
      data = {
        tab: "overview",
        overview: {
          kpis,
          utilization,
          previousUtilization: previous.percent,
          colleges,
          departments,
          accounts,
          jobSize,
          wallTime,
          queueWait,
          outcomes,
          gpu,
        },
      };
      break;
    }
    case "explorer": {
      const { metric, group, view } = params.explorer;
      const topN = view === "time" ? 5 : view === "totals" ? 10 : 25;
      data = { tab: "explorer", explorer: await explorer(metric, group, topN) };
      break;
    }
    case "efficiency": {
      const [kpis, histograms, users] = await Promise.all([
        safe("efficiency KPIs", getEfficiencyKpis(db, ctx), {
          cpu: null,
          memory: null,
          wallTime: null,
          gpu: null,
          failedCpuHours: 0,
          failedShare: null,
          shortJobs: 0,
          shortShare: null,
          jobs: 0,
        }),
        safe("efficiency histograms", getEfficiencyHistograms(db, ctx), { cpu: [], memory: [], gpu: [] }),
        safe("user efficiency", getUserEfficiency(db, ctx), []),
      ]);
      data = { tab: "efficiency", efficiency: { kpis, histograms, users } };
      break;
    }
    case "jobs": {
      const [search, detail] = await Promise.all([
        safe("job search", searchJobs(db, ctx, params.jobs.q, params.jobs.page), {
          jobs: [],
          total: 0,
          truncated: false,
          ignored: [],
          allDates: false,
        }),
        params.jobs.job ? safe("job detail", getJobDetail(db, ctx, params.jobs.job), null) : Promise.resolve(null),
      ]);
      data = { tab: "jobs", jobs: { search, detail } };
      break;
    }
  }
  return { range, period, data };
}
