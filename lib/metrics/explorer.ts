import type { ExplorerGroup, ExplorerMetric, MetricsFilters } from "@/lib/metrics/params";
import { dayBucket, daysIn, isCurrent } from "@/lib/metrics/rollup";
import {
  ACCOUNT_ORG_CTE,
  JOB_SIZE_BUCKETS,
  JOB_SIZE_SQL,
  Params,
  REQ_MEM_MB_SQL,
  STATE_SQL,
  WALL_TIME_BUCKETS,
  WALL_TIME_SQL,
  bucketOf,
  capacityScale,
  endedIn,
  filterConditions,
  num,
  numOrNull,
  ranIn,
  usageBuckets,
  where,
  type MetricsContext,
  type Queryable,
} from "@/lib/metrics/sql";

// One metric grouped by one dimension: the engine behind the Explorer tab and
// several Overview panels. A single query returns, for the top groups and the
// rest ("Other"): each period bucket's value, the range's value, and the
// previous range's value. It reads the daily rollups once they're built
// (ctx.rollup), where a row holds sums instead of one job.

interface MetricDef {
  kind: "usage" | "job";
  // Aggregate over the base rows' columns
  value: string;
  // What picks the top groups
  rank: string;
  // Values add up across groups (so shares mean something)
  additive: boolean;
  columns: string[];
}

const RUN = "j.run_time_seconds";
const CPU_ALLOC = `(${RUN}::numeric * j.req_cpus)`;
const ELIGIBLE = `${RUN} >= 60`; // shorter jobs are left out of efficiency

function memColumns(): string[] {
  const req = `(${REQ_MEM_MB_SQL}) * 1048576`;
  const ok = `${ELIGIBLE} AND j.max_rss > 0 AND ${req} > 0`;
  return [`CASE WHEN ${ok} THEN LEAST(j.max_rss::numeric, ${req}) END AS mem_used`, `CASE WHEN ${ok} THEN ${req} END AS mem_req`];
}

function cpuEffColumns(totalCpu: boolean): string[] {
  if (!totalCpu) return ["NULL::numeric AS cpu_used", "NULL::numeric AS cpu_alloc"];
  const ok = `${ELIGIBLE} AND j.total_cpu_seconds IS NOT NULL AND j.req_cpus > 0`;
  return [
    `CASE WHEN ${ok} THEN LEAST(j.total_cpu_seconds::numeric, ${CPU_ALLOC}) END AS cpu_used`,
    `CASE WHEN ${ok} THEN ${CPU_ALLOC} END AS cpu_alloc`,
  ];
}

function metricDef(metric: ExplorerMetric, ctx: MetricsContext): MetricDef {
  const usage = (value: string, rank: string, additive: boolean): MetricDef => ({
    kind: "usage",
    value,
    rank,
    additive,
    columns: [
      "j.req_cpus * s.secs AS cpu_s",
      "COALESCE(j.gpu_count, 0) * s.secs AS gpu_s",
      "COALESCE(j.req_nodes, 0) * s.secs AS node_s",
      "j.user_id",
      "j.cluster",
    ],
  });
  const job = (value: string, columns: string[], rank = "COUNT(*)"): MetricDef => ({
    kind: "job",
    value,
    rank,
    additive: value === "COUNT(*)",
    columns,
  });
  switch (metric) {
    case "cpuHours":
      return usage("SUM(cpu_s) / 3600.0", "SUM(cpu_s)", true);
    case "gpuHours":
      return usage("SUM(gpu_s) / 3600.0", "SUM(gpu_s)", true);
    case "nodeHours":
      return usage("SUM(node_s) / 3600.0", "SUM(node_s)", true);
    case "users":
      return usage("COUNT(DISTINCT user_id)", "SUM(cpu_s)", false);
    case "utilization":
      // Allocated core-seconds; divided by capacity afterwards
      return usage("SUM(cpu_s)", "SUM(cpu_s)", true);
    case "jobs":
      return job("COUNT(*)", []);
    case "avgWait":
      return job("AVG(wait_s) / 60.0", ["j.wait_time_seconds AS wait_s"]);
    case "avgSize":
      return job("AVG(cpus)", ["j.req_cpus AS cpus"]);
    case "avgWall":
      return job("AVG(run_s) / 3600.0", [`${RUN} AS run_s`]);
    case "memEfficiency":
      return job("100.0 * SUM(mem_used) / NULLIF(SUM(mem_req), 0)", memColumns(), "COUNT(mem_req)");
    case "cpuEfficiency":
      return job("100.0 * SUM(cpu_used) / NULLIF(SUM(cpu_alloc), 0)", cpuEffColumns(ctx.totalCpu), "SUM(cpu_alloc)");
  }
}

// The job metrics over rollup rows; usage metrics keep their definitions,
// since the rollups use the same column names (cpu_s, gpu_s, node_s, user_id).
// sums: the rollup columns a metric adds up, summed per group and bucket
// before ranking.
const ROLLUP_JOB_METRICS: Partial<Record<ExplorerMetric, { value: string; rank: string; sums: string[] }>> = {
  jobs: { value: "SUM(jobs)", rank: "SUM(jobs)", sums: ["jobs"] },
  avgWait: { value: "SUM(wait_s) / NULLIF(SUM(wait_n), 0) / 60.0", rank: "SUM(jobs)", sums: ["jobs", "wait_s", "wait_n"] },
  avgSize: { value: "SUM(cpus_sum) / NULLIF(SUM(cpus_n), 0)", rank: "SUM(jobs)", sums: ["jobs", "cpus_sum", "cpus_n"] },
  avgWall: {
    value: "SUM(runtime_s) / NULLIF(SUM(runtime_n), 0) / 3600.0",
    rank: "SUM(jobs)",
    sums: ["jobs", "runtime_s", "runtime_n"],
  },
  memEfficiency: {
    value: "100.0 * SUM(mem_used) / NULLIF(SUM(mem_req), 0)",
    rank: "SUM(mem_n)",
    sums: ["mem_used", "mem_req", "mem_n"],
  },
  cpuEfficiency: {
    value: "100.0 * SUM(cpu_used) / NULLIF(SUM(cpu_alloc), 0)",
    rank: "SUM(cpu_alloc)",
    sums: ["cpu_used", "cpu_alloc"],
  },
};
const ROLLUP_USAGE_SUMS = ["cpu_s", "gpu_s", "node_s"];

interface GroupDef {
  sql: string;
  joins: string[];
  org?: boolean;
  // Fixed order, for groups that are buckets
  order?: string[];
}

function groupDef(group: ExplorerGroup, rollup: boolean): GroupDef {
  // The rollups store these buckets
  if (rollup && group === "jobSize") return { sql: "j.size_bucket", joins: [], order: JOB_SIZE_BUCKETS };
  if (rollup && group === "wallTime") return { sql: "j.wall_bucket", joins: [], order: WALL_TIME_BUCKETS };
  if (rollup && group === "state") return { sql: "j.state", joins: [] };
  switch (group) {
    case "account":
      return { sql: "COALESCE(a.name, '(none)')", joins: ["LEFT JOIN accounts a ON a.id = j.account_id"] };
    case "user":
      return { sql: "COALESCE(u.name, '(none)')", joins: ["LEFT JOIN users u ON u.id = j.user_id"] };
    case "college":
      return {
        sql: "COALESCE(org.college, '(unmapped)')",
        joins: ["LEFT JOIN acct_org org ON org.account_id = j.account_id"],
        org: true,
      };
    case "department":
      return {
        sql: "COALESCE(org.department, '(unmapped)')",
        joins: ["LEFT JOIN acct_org org ON org.account_id = j.account_id"],
        org: true,
      };
    case "partition":
      return { sql: "COALESCE(NULLIF(j.partition, ''), '(none)')", joins: [] };
    case "qos":
      return { sql: "COALESCE(NULLIF(j.qos, ''), '(none)')", joins: [] };
    case "jobSize":
      return { sql: JOB_SIZE_SQL, joins: [], order: JOB_SIZE_BUCKETS };
    case "wallTime":
      return { sql: WALL_TIME_SQL, joins: [], order: WALL_TIME_BUCKETS };
    case "state":
      return { sql: STATE_SQL, joins: [] };
    case "cluster":
      return { sql: "j.cluster", joins: [] };
  }
}

export interface ExplorerSeries {
  key: string; // group value, or "" for Other
  other: boolean;
  total: number | null;
  prior: number | null;
  share: number | null;
  // One per range bucket
  values: (number | null)[];
}

export interface ExplorerResult {
  metric: ExplorerMetric;
  group: ExplorerGroup;
  buckets: string[];
  additive: boolean;
  series: ExplorerSeries[];
  // The whole selection, all groups together
  total: number | null;
  prior: number | null;
  totals: (number | null)[];
  // Why the metric can't be shown, when it can't
  unavailable?: string;
}

export interface ExplorerOptions {
  metric: ExplorerMetric;
  group: ExplorerGroup;
  topN: number;
  // Override the shared filters (Overview's drill-down)
  filters?: MetricsFilters;
}

// The base rows from job_history: one per job and period bucket for usage
// metrics, one per job for the others
function rawBase(ctx: MetricsContext, p: Params, def: MetricDef, cols: string, joins: string, filters: string[]): string {
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const prevFrom = p.add(ctx.range.prevFrom);
  const tz = p.add(ctx.timeZone);
  let base: string;
  if (def.kind === "usage") {
    const part = (a: string, b: string, cur: boolean) => `
      SELECT ${cols}, s.bucket, ${cur} AS cur
      FROM job_history j
      ${joins}
      ${usageBuckets(a, b, ctx.period, tz)}
      ${where([ranIn(a, b), "s.secs > 0", ...filters])}`;
    base = `${part(from, to, true)}\n      UNION ALL${part(prevFrom, from, false)}`;
  } else {
    base = `
      SELECT ${cols}, ${bucketOf("j.end_time", ctx.period, tz)} AS bucket, j.end_time >= ${from} AS cur
      FROM job_history j
      ${joins}
      ${where([endedIn(prevFrom, to), ...filters])}`;
  }
  return base;
}

export async function runExplorer(db: Queryable, ctx: MetricsContext, opts: ExplorerOptions): Promise<ExplorerResult> {
  const { metric, group } = opts;
  const buckets = ctx.range.buckets;
  const empty: ExplorerResult = {
    metric,
    group,
    buckets,
    additive: false,
    series: [],
    total: null,
    prior: null,
    totals: buckets.map(() => null),
  };
  if (metric === "cpuEfficiency" && !ctx.totalCpu) {
    return { ...empty, unavailable: "CPU efficiency needs slurm-history-ingestor 1.1, which records the CPU time jobs used." };
  }
  if (metric === "utilization" && !ctx.capacity) {
    return { ...empty, unavailable: "Utilization needs the cluster capacity the dashboard records with node history." };
  }

  const def = metricDef(metric, ctx);
  const rollupJob = ctx.rollup && def.kind === "job" ? ROLLUP_JOB_METRICS[metric] : undefined;
  if (rollupJob) Object.assign(def, { value: rollupJob.value, rank: rollupJob.rank });
  const g = groupDef(group, ctx.rollup);
  const p = new Params();
  const filters = filterConditions(opts.filters ?? ctx.filters, p);
  const joins = g.joins.join("\n");
  const cols = [`${g.sql} AS grp`, ...def.columns].join(", ");

  let base: string;
  if (ctx.rollup) {
    // Usage rows have run_s, rows of jobs that ended have jobs. Summed per
    // group and bucket first (and per user, for distinct users), which the
    // metric's sums and ratios of sums don't change.
    const sums = rollupJob?.sums ?? ROLLUP_USAGE_SUMS;
    const users = metric === "users" ? ", j.user_id" : "";
    base = `
      SELECT ${g.sql} AS grp, ${dayBucket(ctx.period)} AS bucket, ${isCurrent(ctx, p)} AS cur${users},
             ${sums.map((c) => `SUM(j.${c}) AS ${c}`).join(", ")}
      FROM job_daily j
      ${joins}
      ${where([daysIn(ctx, p, "both"), def.kind === "usage" ? "j.run_s > 0" : "j.jobs > 0", ...filters])}
      GROUP BY 1, 2, 3${users}`;
  } else {
    base = rawBase(ctx, p, def, cols, joins, filters);
  }

  const topN = p.add(g.order ? g.order.length : opts.topN);
  const sql = `
    WITH ${g.org ? `${ACCOUNT_ORG_CTE},` : ""}
    base AS (${base}),
    ranked AS (
      SELECT grp FROM base WHERE cur GROUP BY grp
      ORDER BY ${def.rank} DESC NULLS LAST, grp LIMIT ${topN}
    ),
    mapped AS (
      SELECT CASE WHEN grp IN (SELECT grp FROM ranked) THEN grp END AS g, base.* FROM base
    )
    SELECT g, cur, bucket, GROUPING(g) AS all_groups, GROUPING(bucket) AS whole_range,
           ${def.value} AS v, ${def.rank} AS r
    FROM mapped
    GROUP BY GROUPING SETS ((g, cur, bucket), (g, cur), (cur, bucket), (cur))`;

  const { rows } = await db.query(sql, p.values);

  // Utilization: allocated core-seconds over available capacity, counting
  // only buckets with capacity recorded
  let capacity: Map<string, number> | undefined; // `${cur}|${bucket}|${cluster}` -> seconds
  if (metric === "utilization") capacity = await capacityByBucket(db, ctx, opts.filters ?? ctx.filters);
  const capOf = (cur: boolean, bucket: string | null, cluster?: string) => {
    if (!capacity) return 0;
    if (bucket !== null) return capacity.get(`${cur}|${bucket}|${cluster ?? "*"}`) ?? 0;
    let sum = 0;
    for (const [k, v] of capacity) {
      const [c, , cl] = k.split("|");
      if (c === String(cur) && cl === (cluster ?? "*")) sum += v;
    }
    return sum;
  };
  const capBuckets = (cur: boolean) =>
    new Set([...(capacity?.keys() ?? [])].filter((k) => k.startsWith(`${cur}|`)).map((k) => k.split("|")[1]));

  interface Acc {
    total: number | null;
    prior: number | null;
    byBucket: Map<string, number | null>;
    prevByBucket: Map<string, number>;
    rank: number;
  }
  const accs = new Map<string | null, Acc>(); // null key: Other; "*": all groups
  const accOf = (key: string | null) => {
    let a = accs.get(key);
    if (!a) {
      a = { total: null, prior: null, byBucket: new Map(), prevByBucket: new Map(), rank: 0 };
      accs.set(key, a);
    }
    return a;
  };
  for (const row of rows) {
    const key = num(row.all_groups) ? "*" : (row.g as string | null);
    const a = accOf(key);
    const v = numOrNull(row.v);
    if (num(row.whole_range)) {
      if (row.cur) {
        a.total = v;
        a.rank = num(row.r);
      } else {
        a.prior = v;
      }
    } else if (row.cur) {
      a.byBucket.set(row.bucket, v);
    } else if (metric === "utilization") {
      a.prevByBucket.set(row.bucket, v ?? 0);
    }
  }

  if (capacity) {
    const curBuckets = capBuckets(true);
    const prevBuckets = capBuckets(false);
    for (const [key, a] of accs) {
      const cluster = group === "cluster" && key !== "*" && key !== null ? key : undefined;
      const util = (seconds: number, available: number) => (available > 0 ? (100 * seconds) / available : null);
      for (const b of curBuckets) if (!a.byBucket.has(b)) a.byBucket.set(b, 0);
      let used = 0;
      for (const [b, v] of a.byBucket) {
        if (curBuckets.has(b)) used += v ?? 0;
        a.byBucket.set(b, curBuckets.has(b) ? util(v ?? 0, capOf(true, b, cluster)) : null);
      }
      let prevUsed = 0;
      for (const [b, v] of a.prevByBucket) if (prevBuckets.has(b)) prevUsed += v;
      a.total = util(used, capOf(true, null, cluster));
      a.prior = util(prevUsed, capOf(false, null, cluster));
    }
  }

  const fill = (a: Acc | undefined) =>
    buckets.map((b) => {
      const v = a?.byBucket.get(b);
      if (v !== undefined) return v;
      // An empty bucket is zero for counts and sums; averages have no value
      return def.additive && metric !== "utilization" ? 0 : null;
    });

  const all = accs.get("*");
  const grand = all?.total ?? null;
  const series: ExplorerSeries[] = [];
  const named = [...accs.entries()].filter(([k]) => k !== "*" && k !== null) as [string, Acc][];
  if (g.order) {
    named.sort(([x], [y]) => g.order!.indexOf(x) - g.order!.indexOf(y));
  } else {
    named.sort(([kx, x], [ky, y]) => y.rank - x.rank || (kx < ky ? -1 : kx > ky ? 1 : 0));
  }
  const other = accs.get(null);
  for (const [key, a] of [...named, ...(other ? [["", other] as [string, Acc]] : [])]) {
    series.push({
      key,
      other: a === other,
      total: a.total,
      prior: a.prior,
      share: def.additive && grand ? (a.total ?? 0) / grand : null,
      values: fill(a),
    });
  }

  return {
    metric,
    group,
    buckets,
    additive: def.additive,
    series,
    total: grand,
    prior: all?.prior ?? null,
    totals: fill(all),
  };
}

// Available core-seconds by range ("true" the current one, "false" the
// previous one), bucket and cluster ("*" for all of them), scaled to the
// whole bucket where capacity was recorded for only part of it
async function capacityByBucket(db: Queryable, ctx: MetricsContext, filters: MetricsFilters): Promise<Map<string, number>> {
  const p = new Params();
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const prevFrom = p.add(ctx.range.prevFrom);
  const tz = p.add(ctx.timeZone);
  const conditions = [`c.hour >= ${prevFrom}`, `c.hour < ${to}`];
  if (filters.clusters.length) conditions.push(`c.cluster = ANY(${p.add(filters.clusters)}::text[])`);
  const lo = `CASE WHEN c.hour >= ${from} THEN ${from} ELSE ${prevFrom} END`;
  const hi = `CASE WHEN c.hour >= ${from} THEN ${to} ELSE ${from} END`;
  const { rows } = await db.query(
    `SELECT c.hour >= ${from} AS cur, ${bucketOf("c.hour", ctx.period, tz)} AS bucket, c.cluster,
            SUM(c.cpu_seconds_available) * ${capacityScale(lo, hi, ctx.period, tz)} AS available
     FROM cluster_capacity c
     ${where(conditions)}
     GROUP BY 1, 2, 3`,
    p.values
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const add = (k: string) => out.set(k, (out.get(k) ?? 0) + num(r.available));
    add(`${r.cur}|${r.bucket}|${r.cluster}`);
    add(`${r.cur}|${r.bucket}|*`);
  }
  return out;
}
