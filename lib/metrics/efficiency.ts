import { HIST, daysIn } from "@/lib/metrics/rollup";
import {
  FAILED_STATES,
  Params,
  REQ_MEM_MB_SQL,
  STATE_SQL,
  endedIn,
  filterConditions,
  num,
  numOrNull,
  where,
  type MetricsContext,
  type Queryable,
} from "@/lib/metrics/sql";

// The Efficiency tab: how much of what jobs were given they used. Covers jobs
// that ended in the range; jobs under a minute are left out of the
// efficiency figures (they're counted in "short jobs" instead).
//
// - CPU: CPU time used (total_cpu_seconds) over cores x run time
// - memory: peak RSS (max_rss) over requested memory
// - wall time: run time over the time limit
// - GPU: average utilization from GPU history, weighted by GPU hours
//
// Each figure is a ratio of sums, so the daily rollups (ctx.rollup) keep the
// sums and the same bins.

const RUN = "j.run_time_seconds";
const ELIGIBLE = `${RUN} >= 60`;
const CPU_ALLOC = `(${RUN}::numeric * j.req_cpus)`;
const MEM_REQ = `((${REQ_MEM_MB_SQL}) * 1048576)`;

// Per-job ratios (0-1), NULL when the job doesn't qualify
function ratios(ctx: MetricsContext) {
  return {
    cpu: ctx.totalCpu
      ? `CASE WHEN ${ELIGIBLE} AND j.total_cpu_seconds IS NOT NULL AND j.req_cpus > 0
              THEN LEAST(j.total_cpu_seconds / ${CPU_ALLOC}, 1) END`
      : "NULL::numeric",
    mem: `CASE WHEN ${ELIGIBLE} AND j.max_rss > 0 AND ${MEM_REQ} > 0 THEN LEAST(j.max_rss / ${MEM_REQ}, 1) END`,
    wall: `CASE WHEN ${ELIGIBLE} AND j.timelimit_minutes > 0 THEN LEAST(${RUN} / (j.timelimit_minutes * 60.0), 1) END`,
    gpu: ctx.gpuHistory
      ? `CASE WHEN ${ELIGIBLE} AND j.gpu_count > 0 AND g.job_id IS NOT NULL THEN LEAST(g.avg_utilization / 100.0, 1) END`
      : "NULL::numeric",
  };
}

const gpuJoin = (ctx: MetricsContext) => (ctx.gpuHistory ? "LEFT JOIN job_gpu_metrics g ON g.job_id = j.job_id::text" : "");

export interface EfficiencyKpis {
  // 0-1, null when nothing in the range has the data
  cpu: number | null;
  memory: number | null;
  wallTime: number | null;
  gpu: number | null;
  failedCpuHours: number;
  failedShare: number | null;
  shortJobs: number;
  shortShare: number | null;
  jobs: number;
}

export async function getEfficiencyKpis(db: Queryable, ctx: MetricsContext): Promise<EfficiencyKpis> {
  const p = new Params();
  const { rows } = ctx.rollup
    ? await db.query(
        `SELECT SUM(j.jobs) AS jobs,
                SUM(j.short_jobs) AS short_jobs,
                SUM(j.core_s) / 3600.0 AS cpu_hours,
                SUM(j.core_s) FILTER (WHERE j.state = ANY(${p.add(FAILED_STATES)}::text[])) / 3600.0 AS failed_cpu_hours,
                SUM(j.cpu_used) / NULLIF(SUM(j.cpu_alloc), 0) AS cpu,
                SUM(j.mem_used) / NULLIF(SUM(j.mem_req), 0) AS mem,
                SUM(j.wall_used_min) / NULLIF(SUM(j.wall_limit_min), 0) AS wall,
                ${ctx.gpuHistory ? "SUM(j.gpu_eff_w) / NULLIF(SUM(j.gpu_eff_s), 0)" : "NULL::numeric"} AS gpu
         FROM job_daily j
         ${where([daysIn(ctx, p), "j.jobs > 0", ...filterConditions(ctx.filters, p)])}`,
        p.values
      )
    : await efficiencyKpisRaw(db, ctx, p);
  const row = rows[0] ?? {};
  const jobs = num(row.jobs);
  const cpuHours = num(row.cpu_hours);
  return {
    cpu: numOrNull(row.cpu),
    memory: numOrNull(row.mem),
    wallTime: numOrNull(row.wall),
    gpu: numOrNull(row.gpu),
    failedCpuHours: num(row.failed_cpu_hours),
    failedShare: cpuHours > 0 ? num(row.failed_cpu_hours) / cpuHours : null,
    shortJobs: num(row.short_jobs),
    shortShare: jobs > 0 ? num(row.short_jobs) / jobs : null,
    jobs,
  };
}

function efficiencyKpisRaw(db: Queryable, ctx: MetricsContext, p: Params) {
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const r = ratios(ctx);
  const cpuH = `COALESCE(j.req_cpus, 0) * COALESCE(${RUN}, 0) / 3600.0`;
  const gpuS = `COALESCE(j.gpu_count, 0) * ${RUN}`;
  return db.query(
    `SELECT COUNT(*) AS jobs,
            COUNT(*) FILTER (WHERE COALESCE(${RUN}, 0) < 60) AS short_jobs,
            SUM(${cpuH}) AS cpu_hours,
            SUM(${cpuH}) FILTER (WHERE ${STATE_SQL} = ANY(${p.add(FAILED_STATES)}::text[])) AS failed_cpu_hours,
            SUM(${r.cpu} * ${CPU_ALLOC}) / NULLIF(SUM(${CPU_ALLOC}) FILTER (WHERE ${r.cpu} IS NOT NULL), 0) AS cpu,
            SUM(${r.mem} * ${MEM_REQ}) / NULLIF(SUM(${MEM_REQ}) FILTER (WHERE ${r.mem} IS NOT NULL), 0) AS mem,
            SUM(${r.wall} * j.timelimit_minutes) / NULLIF(SUM(j.timelimit_minutes) FILTER (WHERE ${r.wall} IS NOT NULL), 0) AS wall,
            SUM(${r.gpu} * ${gpuS}) / NULLIF(SUM(${gpuS}) FILTER (WHERE ${r.gpu} IS NOT NULL), 0) AS gpu
     FROM job_history j
     ${gpuJoin(ctx)}
     ${where([endedIn(from, to), ...filterConditions(ctx.filters, p)])}`,
    p.values
  );
}

export interface EfficiencyHistograms {
  // Ten 10% bins each
  cpu: number[]; // CPU hours
  memory: number[]; // jobs
  gpu: number[]; // GPU hours
}

export async function getEfficiencyHistograms(db: Queryable, ctx: MetricsContext): Promise<EfficiencyHistograms> {
  const p = new Params();
  let rows;
  if (ctx.rollup) {
    const kinds = [HIST.cpuEff, HIST.memEff, ...(ctx.gpuHistory ? [HIST.gpuEff] : [])];
    ({ rows } = await db.query(
      `SELECT CASE j.kind WHEN ${HIST.cpuEff} THEN 'cpu' WHEN ${HIST.memEff} THEN 'mem' ELSE 'gpu' END AS kind,
              j.bin, SUM(j.w) AS w
       FROM job_daily_hist j
       ${where([`j.kind = ANY(${p.add(kinds)}::smallint[])`, daysIn(ctx, p), ...filterConditions(ctx.filters, p)])}
       GROUP BY 1, 2`,
      p.values
    ));
  } else {
    ({ rows } = await efficiencyHistogramsRaw(db, ctx, p));
  }
  const out: EfficiencyHistograms = { cpu: Array(10).fill(0), memory: Array(10).fill(0), gpu: Array(10).fill(0) };
  for (const row of rows) {
    const key = row.kind === "mem" ? "memory" : (row.kind as "cpu" | "gpu");
    out[key][Math.max(0, Math.min(9, num(row.bin)))] = num(row.w);
  }
  return out;
}

function efficiencyHistogramsRaw(db: Queryable, ctx: MetricsContext, p: Params) {
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const r = ratios(ctx);
  const bin = (ratio: string) => `LEAST(FLOOR((${ratio}) * 10), 9)`;
  return db.query(
    `SELECT v.kind, v.bin, SUM(v.w) AS w
     FROM job_history j
     ${gpuJoin(ctx)}
     CROSS JOIN LATERAL (VALUES
       ('cpu', ${bin(r.cpu)}, ${CPU_ALLOC} / 3600.0),
       ('mem', ${bin(r.mem)}, 1),
       ('gpu', ${bin(r.gpu)}, COALESCE(j.gpu_count, 0) * ${RUN} / 3600.0)
     ) AS v(kind, bin, w)
     ${where([endedIn(from, to), "v.bin IS NOT NULL", ...filterConditions(ctx.filters, p)])}
     GROUP BY 1, 2`,
    p.values
  );
}

export interface UserEfficiencyRow {
  user: string;
  account: string | null;
  cpuHours: number;
  // Allocated CPU hours the jobs didn't use; null without CPU time data
  unusedCpuHours: number | null;
  cpu: number | null;
  memory: number | null;
  wallTime: number | null;
  gpu: number | null;
  jobs: number;
}

// Users ranked by the allocated CPU hours they left unused (by CPU hours
// when CPU time isn't recorded)
export async function getUserEfficiency(db: Queryable, ctx: MetricsContext, limit = 25): Promise<UserEfficiencyRow[]> {
  const p = new Params();
  const { rows } = ctx.rollup ? await userEfficiencyRollup(db, ctx, p, limit) : await userEfficiencyRaw(db, ctx, p, limit);
  return rows.map((row) => ({
    user: row.user_name,
    account: row.account,
    jobs: num(row.jobs),
    cpuHours: num(row.cpu_hours),
    unusedCpuHours: numOrNull(row.unused),
    cpu: numOrNull(row.cpu),
    memory: numOrNull(row.mem),
    wallTime: numOrNull(row.wall),
    gpu: numOrNull(row.gpu),
  }));
}

// A user's account is the one most of their counted jobs ran under
function userEfficiencyRollup(db: Queryable, ctx: MetricsContext, p: Params, limit: number) {
  const scope = () => where([daysIn(ctx, p), "j.eligible_jobs > 0", ...filterConditions(ctx.filters, p)]);
  const unused = ctx.totalCpu ? "(SUM(j.cpu_alloc) - SUM(j.cpu_used)) / 3600.0" : "NULL::numeric";
  return db.query(
    `WITH per_user AS (
       SELECT j.user_id,
              SUM(j.eligible_jobs) AS jobs,
              SUM(j.eligible_core_s) / 3600.0 AS cpu_hours,
              CASE WHEN SUM(j.cpu_alloc) > 0 THEN ${unused} END AS unused,
              SUM(j.cpu_used) / NULLIF(SUM(j.cpu_alloc), 0) AS cpu,
              SUM(j.mem_used) / NULLIF(SUM(j.mem_req), 0) AS mem,
              SUM(j.wall_used_min) / NULLIF(SUM(j.wall_limit_min), 0) AS wall,
              ${ctx.gpuHistory ? "SUM(j.gpu_eff_w) / NULLIF(SUM(j.gpu_eff_s), 0)" : "NULL::numeric"} AS gpu
       FROM job_daily j
       ${scope()}
       GROUP BY j.user_id
     ),
     top AS (
       SELECT * FROM per_user
       ORDER BY ${ctx.totalCpu ? "unused DESC NULLS LAST," : ""} cpu_hours DESC
       LIMIT ${p.add(limit)}
     ),
     main_account AS (
       SELECT DISTINCT ON (j.user_id) j.user_id, a.name
       FROM job_daily j
       LEFT JOIN accounts a ON a.id = j.account_id
       ${scope()} AND j.user_id IN (SELECT user_id FROM top)
       GROUP BY j.user_id, a.name
       ORDER BY j.user_id, SUM(j.eligible_jobs) DESC, a.name
     )
     SELECT u.name AS user_name, m.name AS account, t.*
     FROM top t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN main_account m ON m.user_id = t.user_id
     ORDER BY ${ctx.totalCpu ? "t.unused DESC NULLS LAST," : ""} t.cpu_hours DESC`,
    p.values
  );
}

function userEfficiencyRaw(db: Queryable, ctx: MetricsContext, p: Params, limit: number) {
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const r = ratios(ctx);
  const gpuS = `COALESCE(j.gpu_count, 0) * ${RUN}`;
  const unused = ctx.totalCpu ? `SUM((1 - ${r.cpu}) * ${CPU_ALLOC}) / 3600.0` : "NULL::numeric";
  return db.query(
    `SELECT u.name AS user_name, mode() WITHIN GROUP (ORDER BY a.name) AS account,
            COUNT(*) AS jobs,
            SUM(${CPU_ALLOC}) / 3600.0 AS cpu_hours,
            ${unused} AS unused,
            SUM(${r.cpu} * ${CPU_ALLOC}) / NULLIF(SUM(${CPU_ALLOC}) FILTER (WHERE ${r.cpu} IS NOT NULL), 0) AS cpu,
            SUM(${r.mem} * ${MEM_REQ}) / NULLIF(SUM(${MEM_REQ}) FILTER (WHERE ${r.mem} IS NOT NULL), 0) AS mem,
            SUM(${r.wall} * j.timelimit_minutes) / NULLIF(SUM(j.timelimit_minutes) FILTER (WHERE ${r.wall} IS NOT NULL), 0) AS wall,
            SUM(${r.gpu} * ${gpuS}) / NULLIF(SUM(${gpuS}) FILTER (WHERE ${r.gpu} IS NOT NULL), 0) AS gpu
     FROM job_history j
     JOIN users u ON u.id = j.user_id
     LEFT JOIN accounts a ON a.id = j.account_id
     ${gpuJoin(ctx)}
     ${where([endedIn(from, to), ELIGIBLE, "j.req_cpus > 0", ...filterConditions(ctx.filters, p)])}
     GROUP BY u.name
     ORDER BY ${ctx.totalCpu ? "unused DESC NULLS LAST," : ""} cpu_hours DESC
     LIMIT ${p.add(limit)}`,
    p.values
  );
}
