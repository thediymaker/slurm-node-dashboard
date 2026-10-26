import { hasListFilters } from "@/lib/metrics/params";
import { HIST, dayBucket, daysIn, histBins, isCurrent, quantile, waitAt, wallUsedAt, wallUsedBucket } from "@/lib/metrics/rollup";
import {
  ACCOUNT_ORG_CTE,
  FAILED_STATES,
  Params,
  STATE_SQL,
  bucketOf,
  capacityScale,
  endedIn,
  filterConditions,
  num,
  numOrNull,
  overlapSeconds,
  ranIn,
  usageBuckets,
  where,
  type MetricsContext,
  type Queryable,
} from "@/lib/metrics/sql";

// The Overview tab's panels that aren't a plain metric-by-group (those come
// from runExplorer). One query per panel, against the daily rollups once
// they're built (ctx.rollup) and job_history until then. Medians from the
// rollups come from bins (lib/metrics/rollup.ts), within a few percent.

const PARTITION_SQL = "COALESCE(NULLIF(j.partition, ''), '(none)')";

export interface OverviewKpis {
  cpuHours: number;
  gpuHours: number;
  nodeHours: number;
  jobs: number;
  users: number;
  accounts: number;
  medianWaitSeconds: number | null;
}

export async function getOverviewKpis(
  db: Queryable,
  ctx: MetricsContext
): Promise<{ current: OverviewKpis; previous: OverviewKpis }> {
  if (ctx.rollup) return getOverviewKpisRollup(db, ctx);
  const p = new Params();
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const prevFrom = p.add(ctx.range.prevFrom);
  const ov = overlapSeconds("r.f", "r.t");
  const { rows } = await db.query(
    `WITH r(k, f, t) AS (VALUES ('current', ${from}::timestamptz, ${to}::timestamptz),
                                ('previous', ${prevFrom}::timestamptz, ${from}::timestamptz))
     SELECT r.k,
            SUM(j.req_cpus * ${ov}) / 3600.0 AS cpu_hours,
            SUM(COALESCE(j.gpu_count, 0) * ${ov}) / 3600.0 AS gpu_hours,
            SUM(COALESCE(j.req_nodes, 0) * ${ov}) / 3600.0 AS node_hours,
            COUNT(*) FILTER (WHERE j.end_time < r.t) AS jobs,
            COUNT(DISTINCT j.user_id) AS users,
            COUNT(DISTINCT j.account_id) AS accounts,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY j.wait_time_seconds) FILTER (WHERE j.end_time < r.t) AS median_wait
     FROM r JOIN job_history j ON ${ranIn("r.f", "r.t")}
     ${where(filterConditions(ctx.filters, p))}
     GROUP BY r.k`,
    p.values
  );
  const read = (k: string): OverviewKpis => {
    const r = rows.find((row) => row.k === k);
    return {
      cpuHours: num(r?.cpu_hours),
      gpuHours: num(r?.gpu_hours),
      nodeHours: num(r?.node_hours),
      jobs: num(r?.jobs),
      users: num(r?.users),
      accounts: num(r?.accounts),
      medianWaitSeconds: numOrNull(r?.median_wait),
    };
  };
  return { current: read("current"), previous: read("previous") };
}

async function getOverviewKpisRollup(
  db: Queryable,
  ctx: MetricsContext
): Promise<{ current: OverviewKpis; previous: OverviewKpis }> {
  const p = new Params();
  const { rows } = await db.query(
    `SELECT (${isCurrent(ctx, p)})::text AS k,
            SUM(j.cpu_s) / 3600.0 AS cpu_hours,
            SUM(j.gpu_s) / 3600.0 AS gpu_hours,
            SUM(j.node_s) / 3600.0 AS node_hours,
            SUM(j.jobs) AS jobs,
            COUNT(DISTINCT j.user_id) AS users,
            COUNT(DISTINCT j.account_id) AS accounts
     FROM job_daily j
     ${where([daysIn(ctx, p, "both"), ...filterConditions(ctx.filters, p)])}
     GROUP BY 1`,
    p.values
  );
  const hp = new Params();
  const waits = await histBins(
    db,
    HIST.wait,
    [daysIn(ctx, hp, "both"), ...filterConditions(ctx.filters, hp)],
    hp,
    `(${isCurrent(ctx, hp)})::text`
  );
  const read = (k: string): OverviewKpis => {
    const r = rows.find((row) => row.k === k);
    return {
      cpuHours: num(r?.cpu_hours),
      gpuHours: num(r?.gpu_hours),
      nodeHours: num(r?.node_hours),
      jobs: num(r?.jobs),
      users: num(r?.users),
      accounts: num(r?.accounts),
      medianWaitSeconds: quantile(waits.get(k) ?? [], 0.5, waitAt),
    };
  };
  return { current: read("true"), previous: read("false") };
}

// Seconds of cores, GPUs or nodes in a bucket
export interface Capacity {
  total: number;
  // On nodes that could run jobs
  available: number;
  allocated: number;
}

export interface UtilizationBucket {
  bucket: string;
  cpu: Capacity;
  gpu: Capacity;
  // Node-seconds on nodes running jobs; null when not recorded, or when
  // allocation comes from job history
  nodes: Capacity | null;
}

export interface Utilization {
  buckets: UtilizationBucket[];
  // Allocated over available, over the buckets with capacity recorded
  percent: number | null;
  gpuPercent: number | null;
  // Allocation as the collector saw it, running jobs included; otherwise
  // from job history, which follows every filter but has only finished jobs
  observed: boolean;
  // When the recorded capacity starts, if after the range's start
  since: string | null;
}

// Capacity is recorded per cluster only, so it follows the cluster filter.
// With only clusters filtered, allocation is what the collector saw over the
// same hours, which counts jobs still running. With other filters it is the
// selected jobs' usage from job history, against capacity scaled to the whole
// bucket, so a bucket capacity was recorded for only part of doesn't show the
// whole bucket's jobs on a fraction of its capacity.
export async function getUtilization(db: Queryable, ctx: MetricsContext, which: "current" | "previous"): Promise<Utilization> {
  if (!ctx.capacity) return { buckets: [], percent: null, gpuPercent: null, observed: true, since: null };
  const observed = !hasListFilters(ctx.filters, ["clusters"]);
  const p = new Params();
  const from = p.add(which === "current" ? ctx.range.from : ctx.range.prevFrom);
  const to = p.add(which === "current" ? ctx.range.to : ctx.range.from);
  const tz = p.add(ctx.timeZone);
  const capWhere = [`c.hour >= ${from}`, `c.hour < ${to}`];
  if (ctx.filters.clusters.length) capWhere.push(`c.cluster = ANY(${p.add(ctx.filters.clusters)}::text[])`);
  const cap = `
       SELECT ${bucketOf("c.hour", ctx.period, tz)} AS bucket, MIN(c.hour) AS first_hour,
              SUM(c.cpu_seconds_total) AS cpu_total, SUM(c.cpu_seconds_available) AS cpu_available,
              SUM(c.cpu_seconds_allocated) AS cpu_allocated,
              SUM(c.gpu_seconds_total) AS gpu_total, SUM(c.gpu_seconds_available) AS gpu_available,
              SUM(c.gpu_seconds_allocated) AS gpu_allocated,
              SUM(c.node_seconds_total) AS node_total, SUM(c.node_seconds_available) AS node_available,
              SUM(c.node_seconds_allocated) AS node_allocated,
              ${observed ? "1" : capacityScale(from, to, ctx.period, tz)} AS scale
       FROM cluster_capacity c
       ${where(capWhere)}
       GROUP BY 1`;
  // A function, as building it adds its parameters, which only the query
  // that uses it may have
  const jh = () =>
    ctx.rollup
      ? `
       SELECT ${dayBucket(ctx.period)} AS bucket, SUM(j.cpu_s) AS cpu, SUM(j.gpu_s) AS gpu
       FROM job_daily j
       ${where([daysIn(ctx, p, which), ...filterConditions(ctx.filters, p)])}
       GROUP BY 1`
      : `
       SELECT s.bucket, SUM(j.req_cpus * s.secs) AS cpu, SUM(COALESCE(j.gpu_count, 0) * s.secs) AS gpu
       FROM job_history j
       ${usageBuckets(from, to, ctx.period, tz)}
       ${where([ranIn(from, to), "s.secs > 0", ...filterConditions(ctx.filters, p)])}
       GROUP BY 1`;
  const { rows } = await db.query(
    observed
      ? `${cap} ORDER BY 1`
      : `WITH cap AS (${cap}), jh AS (${jh()})
         SELECT cap.*, jh.cpu AS jh_cpu, jh.gpu AS jh_gpu
         FROM cap LEFT JOIN jh ON jh.bucket = cap.bucket
         ORDER BY cap.bucket`,
    p.values
  );
  const used = { cpu: 0, gpu: 0 };
  const avail = { cpu: 0, gpu: 0 };
  const buckets = rows.map((r): UtilizationBucket => {
    const scale = num(r.scale) || 1;
    const side = (kind: "cpu" | "gpu"): Capacity => {
      const total = num(r[`${kind}_total`]) * scale;
      const available = num(r[`${kind}_available`]) * scale;
      const allocated = Math.min(observed ? num(r[`${kind}_allocated`]) : num(r[`jh_${kind}`]), available);
      used[kind] += allocated;
      avail[kind] += available;
      return { total, available, allocated };
    };
    const nodes =
      observed && r.node_total !== null
        ? { total: num(r.node_total), available: num(r.node_available), allocated: num(r.node_allocated) }
        : null;
    return { bucket: r.bucket, cpu: side("cpu"), gpu: side("gpu"), nodes };
  });
  const first = rows[0]?.first_hour ? new Date(rows[0].first_hour) : null;
  const start = which === "current" ? ctx.range.from : ctx.range.prevFrom;
  return {
    buckets,
    percent: avail.cpu > 0 ? (100 * used.cpu) / avail.cpu : null,
    gpuPercent: avail.gpu > 0 ? (100 * used.gpu) / avail.gpu : null,
    observed,
    since: first && first.getTime() - start.getTime() > 3_600_000 ? first.toISOString() : null,
  };
}

export interface AccountRow {
  account: string;
  department: string | null;
  cpuHours: number;
  gpuHours: number;
  jobs: number;
  users: number;
  avgWaitSeconds: number | null;
}

export async function getTopAccounts(db: Queryable, ctx: MetricsContext, limit = 10): Promise<AccountRow[]> {
  const p = new Params();
  const { rows } = ctx.rollup
    ? await db.query(
        `WITH ${ACCOUNT_ORG_CTE}
         SELECT a.name AS account, org.department,
                SUM(j.cpu_s) / 3600.0 AS cpu_hours,
                SUM(j.gpu_s) / 3600.0 AS gpu_hours,
                SUM(j.jobs) AS jobs,
                COUNT(DISTINCT j.user_id) AS users,
                SUM(j.wait_s) / NULLIF(SUM(j.wait_n), 0) AS avg_wait
         FROM job_daily j
         JOIN accounts a ON a.id = j.account_id
         LEFT JOIN acct_org org ON org.account_id = j.account_id
         ${where([daysIn(ctx, p), ...filterConditions(ctx.filters, p)])}
         GROUP BY a.name, org.department
         ORDER BY cpu_hours DESC NULLS LAST
         LIMIT ${p.add(limit)}`,
        p.values
      )
    : await topAccountsRaw(db, ctx, p, limit);
  return rows.map((r) => ({
    account: r.account,
    department: r.department,
    cpuHours: num(r.cpu_hours),
    gpuHours: num(r.gpu_hours),
    jobs: num(r.jobs),
    users: num(r.users),
    avgWaitSeconds: numOrNull(r.avg_wait),
  }));
}

function topAccountsRaw(db: Queryable, ctx: MetricsContext, p: Params, limit: number) {
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const ov = overlapSeconds(from, to);
  return db.query(
    `WITH ${ACCOUNT_ORG_CTE}
     SELECT a.name AS account, org.department,
            SUM(j.req_cpus * ${ov}) / 3600.0 AS cpu_hours,
            SUM(COALESCE(j.gpu_count, 0) * ${ov}) / 3600.0 AS gpu_hours,
            COUNT(*) FILTER (WHERE j.end_time < ${to}) AS jobs,
            COUNT(DISTINCT j.user_id) AS users,
            AVG(j.wait_time_seconds) FILTER (WHERE j.end_time < ${to}) AS avg_wait
     FROM job_history j
     JOIN accounts a ON a.id = j.account_id
     LEFT JOIN acct_org org ON org.account_id = j.account_id
     ${where([ranIn(from, to), ...filterConditions(ctx.filters, p)])}
     GROUP BY a.name, org.department
     ORDER BY cpu_hours DESC NULLS LAST
     LIMIT ${p.add(limit)}`,
    p.values
  );
}

export const WALL_USED_BUCKETS = ["< 10%", "10–25%", "25–50%", "50–75%", "75–100%"];

export interface WallTimeUsed {
  counts: number[]; // jobs per WALL_USED_BUCKETS
  median: number | null; // share of the limit, 0-1
}

// Jobs by how much of their time limit they used
export async function getWallTimeUsed(db: Queryable, ctx: MetricsContext): Promise<WallTimeUsed> {
  if (ctx.rollup) {
    const p = new Params();
    const bins = (await histBins(db, HIST.wallUsed, [daysIn(ctx, p), ...filterConditions(ctx.filters, p)], p)).get("") ?? [];
    const counts = WALL_USED_BUCKETS.map(() => 0);
    for (const [bin, w] of bins) counts[wallUsedBucket(bin)] += w;
    return { counts, median: quantile(bins, 0.5, wallUsedAt) };
  }
  const p = new Params();
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const { rows } = await db.query(
    `SELECT b, COUNT(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY used) AS median, GROUPING(b) AS whole
     FROM (
       SELECT LEAST(j.run_time_seconds / (j.timelimit_minutes * 60.0), 1) AS used,
              CASE WHEN j.run_time_seconds < j.timelimit_minutes * 6 THEN 0
                   WHEN j.run_time_seconds < j.timelimit_minutes * 15 THEN 1
                   WHEN j.run_time_seconds < j.timelimit_minutes * 30 THEN 2
                   WHEN j.run_time_seconds < j.timelimit_minutes * 45 THEN 3
                   ELSE 4 END AS b
       FROM job_history j
       ${where([endedIn(from, to), "j.timelimit_minutes > 0", "j.run_time_seconds IS NOT NULL", ...filterConditions(ctx.filters, p)])}
     ) x
     GROUP BY GROUPING SETS ((b), ())`,
    p.values
  );
  const counts = WALL_USED_BUCKETS.map(() => 0);
  let median: number | null = null;
  for (const r of rows) {
    if (num(r.whole)) median = numOrNull(r.median);
    else counts[num(r.b)] = num(r.n);
  }
  return { counts, median };
}

export interface QueueWaitRow {
  partition: string;
  jobs: number;
  p50: number;
  p90: number;
}

export async function getQueueWait(db: Queryable, ctx: MetricsContext, limit = 8): Promise<QueueWaitRow[]> {
  if (ctx.rollup) {
    const p = new Params();
    const byPartition = await histBins(db, HIST.wait, [daysIn(ctx, p), ...filterConditions(ctx.filters, p)], p, PARTITION_SQL);
    return [...byPartition.entries()]
      .map(([partition, bins]) => ({
        partition,
        jobs: bins.reduce((s, [, w]) => s + w, 0),
        p50: quantile(bins, 0.5, waitAt) ?? 0,
        p90: quantile(bins, 0.9, waitAt) ?? 0,
      }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, limit);
  }
  const p = new Params();
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(j.partition, ''), '(none)') AS partition, COUNT(*) AS jobs,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY j.wait_time_seconds) AS p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY j.wait_time_seconds) AS p90
     FROM job_history j
     ${where([endedIn(from, to), "j.wait_time_seconds IS NOT NULL", ...filterConditions(ctx.filters, p)])}
     GROUP BY 1
     ORDER BY jobs DESC
     LIMIT ${p.add(limit)}`,
    p.values
  );
  return rows.map((r) => ({ partition: r.partition, jobs: num(r.jobs), p50: num(r.p50), p90: num(r.p90) }));
}

export interface OutcomeRow {
  state: string;
  jobs: number;
  cpuHours: number;
}

export interface Outcomes {
  states: OutcomeRow[];
  // Share of CPU hours that went to jobs that failed or ran out of time
  failedShare: number | null;
}

export async function getOutcomes(db: Queryable, ctx: MetricsContext): Promise<Outcomes> {
  const p = new Params();
  let rows;
  if (ctx.rollup) {
    ({ rows } = await db.query(
      `SELECT j.state, SUM(j.jobs) AS jobs, SUM(j.core_s) / 3600.0 AS cpu_hours
       FROM job_daily j
       ${where([daysIn(ctx, p), "j.jobs > 0", ...filterConditions(ctx.filters, p)])}
       GROUP BY 1
       ORDER BY jobs DESC`,
      p.values
    ));
  } else {
    const from = p.add(ctx.range.from);
    const to = p.add(ctx.range.to);
    ({ rows } = await db.query(
      `SELECT ${STATE_SQL} AS state, COUNT(*) AS jobs,
              SUM(COALESCE(j.req_cpus, 0) * COALESCE(j.run_time_seconds, 0)) / 3600.0 AS cpu_hours
       FROM job_history j
       ${where([endedIn(from, to), ...filterConditions(ctx.filters, p)])}
       GROUP BY 1
       ORDER BY jobs DESC`,
      p.values
    ));
  }
  const states = rows.map((r) => ({ state: r.state, jobs: num(r.jobs), cpuHours: num(r.cpu_hours) }));
  const total = states.reduce((s, r) => s + r.cpuHours, 0);
  const failed = states.filter((r) => FAILED_STATES.includes(r.state)).reduce((s, r) => s + r.cpuHours, 0);
  return { states, failedShare: total > 0 ? failed / total : null };
}

export interface GpuPartitionRow {
  partition: string;
  gpuHours: number;
  // Average GPU utilization (%) weighted by GPU hours, over jobs with GPU history
  utilization: number | null;
}

export async function getGpuByPartition(db: Queryable, ctx: MetricsContext, limit = 8): Promise<GpuPartitionRow[]> {
  const p = new Params();
  const { rows } = ctx.rollup
    ? await db.query(
        `SELECT ${PARTITION_SQL} AS partition,
                SUM(j.gpu_s) / 3600.0 AS gpu_hours,
                ${ctx.gpuHistory ? "SUM(j.gpu_util_s) / NULLIF(SUM(j.gpu_known_s), 0)" : "NULL::numeric"} AS utilization
         FROM job_daily j
         ${where([daysIn(ctx, p), "j.gpu_s > 0", ...filterConditions(ctx.filters, p)])}
         GROUP BY 1
         ORDER BY gpu_hours DESC
         LIMIT ${p.add(limit)}`,
        p.values
      )
    : await gpuByPartitionRaw(db, ctx, p, limit);
  return rows
    .map((r) => ({ partition: r.partition, gpuHours: num(r.gpu_hours), utilization: numOrNull(r.utilization) }))
    .filter((r) => r.gpuHours > 0);
}

function gpuByPartitionRaw(db: Queryable, ctx: MetricsContext, p: Params, limit: number) {
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const ov = overlapSeconds(from, to);
  const util = ctx.gpuHistory
    ? `SUM(g.avg_utilization * j.gpu_count * ${ov}) / NULLIF(SUM(j.gpu_count * ${ov}) FILTER (WHERE g.job_id IS NOT NULL), 0)`
    : "NULL::numeric";
  return db.query(
    `SELECT COALESCE(NULLIF(j.partition, ''), '(none)') AS partition,
            SUM(j.gpu_count * ${ov}) / 3600.0 AS gpu_hours,
            ${util} AS utilization
     FROM job_history j
     ${ctx.gpuHistory ? "LEFT JOIN job_gpu_metrics g ON g.job_id = j.job_id::text" : ""}
     ${where([ranIn(from, to), "j.gpu_count > 0", ...filterConditions(ctx.filters, p)])}
     GROUP BY 1
     ORDER BY gpu_hours DESC
     LIMIT ${p.add(limit)}`,
    p.values
  );
}
