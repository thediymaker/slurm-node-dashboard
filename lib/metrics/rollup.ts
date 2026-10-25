import { readEnv } from "@/lib/config";
import type { DbPool } from "@/lib/db";
import { expandHostlist } from "@/lib/metrics/hostlist";
import type { Period } from "@/lib/metrics/params";
import {
  JOB_SIZE_SQL,
  REQ_MEM_MB_SQL,
  STATE_SQL,
  WALL_TIME_SQL,
  addDays,
  num,
  todayIn,
  type MetricsContext,
  type Params,
  type Queryable,
} from "@/lib/metrics/sql";

// Daily rollups of job_history (tables in migration 005), so the metrics page
// reads one row per day and dimension combination instead of every job, the
// way XDMoD's aggregate tables work. A finished job never changes, so a day is
// computed once and again only when the ingestor writes jobs that touch it:
// a statement trigger on job_history records those days in
// metrics_rollup_dirty, and the collector recomputes them.
//
// Days are whole days in the metrics time zone. Changing the time zone, or
// this file's definition, rebuilds everything; until the first build
// finishes the page reads job_history directly.

// Bump to rebuild existing rollups after changing what they hold
const DEFINITION = "2";
// Days recomputed per transaction
const CHUNK_DAYS = 14;

export const HIST = { wait: 1, wallUsed: 2, cpuEff: 3, memEff: 4, gpuEff: 5 } as const;

// Wait times: bins 0-99 are exact seconds; from 100 s on, bins are 10% wide
// (bin 100 + k holds 100 x 1.1^k up to 100 x 1.1^(k+1) seconds)
const WAIT_EXACT = 100;
const WAIT_BASE = 1.1;
export const waitAt = (bin: number, frac: number) =>
  bin < WAIT_EXACT ? bin : WAIT_EXACT * Math.pow(WAIT_BASE, bin - WAIT_EXACT + frac);
// Wall time used, as a share of the limit: 0.1% bins below 10% (bins 0-99),
// 1% bins from 10% (bins 100-189)
export const wallUsedAt = (bin: number, frac: number) => (bin < 100 ? (bin + frac) / 1000 : 0.1 + (bin - 100 + frac) / 100);
// The wall time used buckets on the Overview (< 10%, 10-25%, 25-50%, 50-75%, 75-100%)
export const wallUsedBucket = (bin: number) => (bin < 100 ? 0 : bin < 115 ? 1 : bin < 140 ? 2 : bin < 165 ? 3 : 4);

// The q-quantile of binned weights, interpolated within its bin
export function quantile(bins: [number, number][], q: number, valueAt: (bin: number, frac: number) => number): number | null {
  const sorted = bins.filter(([, w]) => w > 0).sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  const target = q * total;
  let seen = 0;
  for (const [bin, w] of sorted) {
    if (seen + w >= target) return valueAt(bin, (target - seen) / w);
    seen += w;
  }
  const [last] = sorted[sorted.length - 1];
  return valueAt(last, 1);
}

export function rollupEnabled(): boolean {
  return Number(readEnv("METRICS_ROLLUP_INTERVAL_SECONDS") ?? 60) > 0;
}

// Whether the page can read the rollups for this time zone
export async function rollupReady(db: Queryable, timeZone: string): Promise<boolean> {
  if (!rollupEnabled()) return false;
  try {
    const { rows } = await db.query("SELECT ready, time_zone FROM metrics_rollup_state WHERE id = 1");
    return Boolean(rows[0]?.ready) && rows[0]?.time_zone === timeZone;
  } catch {
    return false;
  }
}

// --- Reading -----------------------------------------------------------------

// Period bucket key (YYYY-MM-DD of its first day) of a rollup row
export function dayBucket(period: Period): string {
  return `to_char(date_trunc('${period}', j.day::timestamp), 'YYYY-MM-DD')`;
}

// Rollup rows in the current range, the previous one, or both
export function daysIn(ctx: MetricsContext, p: Params, which: "current" | "previous" | "both" = "current"): string {
  const from = which === "current" ? ctx.range.fromDate : ctx.range.prevFromDate;
  const to = which === "previous" ? ctx.range.fromDate : addDays(ctx.range.toDate, 1);
  return `j.day >= ${p.add(from)}::date AND j.day < ${p.add(to)}::date`;
}

// Rows of the current range, in a query over both
export function isCurrent(ctx: MetricsContext, p: Params): string {
  return `j.day >= ${p.add(ctx.range.fromDate)}::date`;
}

// Binned weights of one histogram kind, per group when grpSql is given
export async function histBins(
  db: Queryable,
  kind: number,
  conditions: string[],
  p: Params,
  grpSql?: string
): Promise<Map<string, [number, number][]>> {
  const { rows } = await db.query(
    `SELECT ${grpSql ?? "''"} AS grp, j.bin, SUM(j.w) AS w
     FROM job_daily_hist j
     WHERE j.kind = ${p.add(kind)} AND ${conditions.join(" AND ")}
     GROUP BY 1, 2`,
    p.values
  );
  const out = new Map<string, [number, number][]>();
  for (const r of rows) {
    const list = out.get(r.grp) ?? [];
    list.push([num(r.bin), num(r.w)]);
    out.set(r.grp, list);
  }
  return out;
}

// --- Building ----------------------------------------------------------------

const MARK_SQL = `
  CREATE OR REPLACE FUNCTION metrics_rollup_mark() RETURNS trigger LANGUAGE plpgsql AS $fn$
  DECLARE
    tz TEXT;
  BEGIN
    SELECT time_zone INTO tz FROM metrics_rollup_state WHERE id = 1;
    IF tz IS NULL THEN
      RETURN NULL;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      INSERT INTO metrics_rollup_dirty (day)
      SELECT DISTINCT d::date
      FROM new_rows n
      CROSS JOIN LATERAL generate_series(
        date_trunc('day', LEAST(COALESCE(n.start_time, n.end_time), n.end_time) AT TIME ZONE tz),
        n.end_time AT TIME ZONE tz, interval '1 day') AS d
      WHERE n.end_time IS NOT NULL
      ON CONFLICT DO NOTHING;
      UPDATE metrics_rollup_state s SET max_job_seconds = m.secs
      FROM (SELECT max(EXTRACT(EPOCH FROM n.end_time - n.start_time))::bigint AS secs FROM new_rows n) m
      WHERE s.id = 1 AND m.secs > s.max_job_seconds;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      INSERT INTO metrics_rollup_dirty (day)
      SELECT DISTINCT d::date
      FROM old_rows o
      CROSS JOIN LATERAL generate_series(
        date_trunc('day', LEAST(COALESCE(o.start_time, o.end_time), o.end_time) AT TIME ZONE tz),
        o.end_time AT TIME ZONE tz, interval '1 day') AS d
      WHERE o.end_time IS NOT NULL
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NULL;
  END
  $fn$`;

const TRIGGERS: Record<string, string> = {
  metrics_rollup_ins: "AFTER INSERT ON job_history REFERENCING NEW TABLE AS new_rows",
  metrics_rollup_upd: "AFTER UPDATE ON job_history REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows",
  metrics_rollup_del: "AFTER DELETE ON job_history REFERENCING OLD TABLE AS old_rows",
};

// Creating triggers needs the table's owner: the ingestor's database role
async function ensureTriggers(pool: DbPool) {
  await pool.query(MARK_SQL);
  const { rows } = await pool.query(
    "SELECT tgname FROM pg_trigger WHERE tgrelid = 'job_history'::regclass AND tgname LIKE 'metrics_rollup_%'"
  );
  const have = new Set(rows.map((r: { tgname: string }) => r.tgname));
  for (const [name, when] of Object.entries(TRIGGERS)) {
    if (have.has(name)) continue;
    await pool.query(`CREATE TRIGGER ${name} ${when} FOR EACH STATEMENT EXECUTE FUNCTION metrics_rollup_mark()`);
  }
}

const DIMS = ["cluster", "partition", "qos", "account_id", "user_id", "state", "size_bucket", "wall_bucket"];
const USAGE_COLS = ["run_s", "cpu_s", "gpu_s", "node_s", "gpu_util_s", "gpu_known_s"];
const ENDED_COLS = [
  "jobs",
  "short_jobs",
  "wait_n",
  "wait_s",
  "cpus_n",
  "cpus_sum",
  "runtime_n",
  "runtime_s",
  "core_s",
  "eligible_jobs",
  "eligible_core_s",
  "cpu_used",
  "cpu_alloc",
  "mem_n",
  "mem_used",
  "mem_req",
  "wall_used_min",
  "wall_limit_min",
  "gpu_eff_w",
  "gpu_eff_s",
];

// Recompute the given days: $1 days, $2 time zone, $3 longest job in seconds.
// Returns each day's jobs per node list, which are expanded into nodes here.
// The definitions match the job_history queries in this directory.
function computeSql(totalCpu: boolean): string {
  const run = "j.run_time_seconds";
  const eligible = `${run} >= 60`;
  const cpuAlloc = `(${run}::numeric * j.req_cpus)`;
  const memReq = `((${REQ_MEM_MB_SQL}) * 1048576)`;
  const rCpu = totalCpu
    ? `CASE WHEN ${eligible} AND j.total_cpu_seconds IS NOT NULL AND j.req_cpus > 0 THEN LEAST(j.total_cpu_seconds / ${cpuAlloc}, 1) END`
    : "NULL::numeric";
  const zero = (cols: string[]) => cols.map((c) => `0 AS ${c}`).join(", ");
  const sum = (cols: string[]) => cols.map((c) => `COALESCE(SUM(${c}), 0)`).join(", ");
  return `
    WITH b AS (
      SELECT (min(d)::timestamp AT TIME ZONE $2) AS lo, ((max(d) + 1)::timestamp AT TIME ZONE $2) AS hi
      FROM unnest($1::date[]) AS d
    ),
    ratios AS (
      SELECT (j.end_time AT TIME ZONE $2)::date AS day, j.cluster, j.partition, j.qos, j.account_id, j.user_id,
             ${STATE_SQL} AS state, ${JOB_SIZE_SQL} AS size_bucket, ${WALL_TIME_SQL} AS wall_bucket, j.node_list,
             j.req_cpus, j.gpu_count, j.wait_time_seconds AS wait, ${run} AS run, j.timelimit_minutes AS tl,
             ${eligible} AS eligible, ${cpuAlloc} AS alloc, ${memReq} AS mreq,
             ${rCpu} AS r_cpu,
             CASE WHEN ${eligible} AND j.max_rss > 0 AND ${memReq} > 0 THEN LEAST(j.max_rss / ${memReq}, 1) END AS r_mem,
             CASE WHEN ${eligible} AND j.timelimit_minutes > 0 THEN LEAST(${run} / (j.timelimit_minutes * 60.0), 1) END AS r_wall,
             CASE WHEN ${eligible} AND j.gpu_count > 0 AND g.job_id IS NOT NULL THEN LEAST(g.avg_utilization / 100.0, 1) END AS r_gpu
      FROM job_history j
      LEFT JOIN job_gpu_metrics g ON g.job_id = j.job_id::text
      WHERE j.end_time >= (SELECT lo FROM b) AND j.end_time < (SELECT hi FROM b)
        AND (j.end_time AT TIME ZONE $2)::date = ANY($1::date[])
    ),
    ended AS MATERIALIZED (
      SELECT day, ${DIMS.join(", ")}, node_list,
             1 AS jobs,
             (COALESCE(run, 0) < 60)::int AS short_jobs,
             (wait IS NOT NULL)::int AS wait_n,
             COALESCE(wait, 0) AS wait_s,
             (req_cpus IS NOT NULL)::int AS cpus_n,
             COALESCE(req_cpus, 0) AS cpus_sum,
             (run IS NOT NULL)::int AS runtime_n,
             COALESCE(run, 0) AS runtime_s,
             COALESCE(req_cpus, 0) * COALESCE(run, 0) AS core_s,
             COALESCE(eligible AND req_cpus > 0, false)::int AS eligible_jobs,
             CASE WHEN eligible AND req_cpus > 0 THEN alloc ELSE 0 END AS eligible_core_s,
             COALESCE(r_cpu * alloc, 0) AS cpu_used,
             CASE WHEN r_cpu IS NOT NULL THEN alloc ELSE 0 END AS cpu_alloc,
             (r_mem IS NOT NULL)::int AS mem_n,
             COALESCE(r_mem * mreq, 0) AS mem_used,
             CASE WHEN r_mem IS NOT NULL THEN mreq ELSE 0 END AS mem_req,
             COALESCE(r_wall * tl, 0) AS wall_used_min,
             CASE WHEN r_wall IS NOT NULL THEN tl ELSE 0 END AS wall_limit_min,
             COALESCE(r_gpu * gpu_count * run, 0) AS gpu_eff_w,
             CASE WHEN r_gpu IS NOT NULL THEN gpu_count * run ELSE 0 END AS gpu_eff_s,
             CASE WHEN wait IS NULL THEN NULL
                  WHEN wait < ${WAIT_EXACT} THEN GREATEST(wait, 0)::int
                  ELSE ${WAIT_EXACT} + FLOOR(LN(wait / ${WAIT_EXACT}.0) / LN(${WAIT_BASE}))::int END AS wait_bin,
             CASE WHEN tl > 0 AND run IS NOT NULL THEN
               CASE WHEN run < tl * 6 THEN FLOOR(run / (tl * 0.06))::int
                    ELSE LEAST(100 + FLOOR((run / (tl * 60.0) - 0.1) * 100), 189)::int END END AS wall_used_bin,
             LEAST(FLOOR(r_cpu * 10), 9)::int AS cpu_bin, alloc / 3600.0 AS cpu_hours,
             LEAST(FLOOR(r_mem * 10), 9)::int AS mem_bin,
             LEAST(FLOOR(r_gpu * 10), 9)::int AS gpu_bin, COALESCE(gpu_count, 0) * run / 3600.0 AS gpu_hours
      FROM ratios
    ),
    usage AS (
      SELECT s.day, j.cluster, j.partition, j.qos, j.account_id, j.user_id,
             ${STATE_SQL} AS state, ${JOB_SIZE_SQL} AS size_bucket, ${WALL_TIME_SQL} AS wall_bucket,
             s.secs AS run_s,
             j.req_cpus * s.secs AS cpu_s,
             COALESCE(j.gpu_count, 0) * s.secs AS gpu_s,
             COALESCE(j.req_nodes, 0) * s.secs AS node_s,
             CASE WHEN g.job_id IS NOT NULL AND j.gpu_count > 0 THEN g.avg_utilization * j.gpu_count * s.secs END AS gpu_util_s,
             CASE WHEN g.job_id IS NOT NULL AND j.gpu_count > 0 THEN j.gpu_count * s.secs END AS gpu_known_s
      FROM job_history j
      LEFT JOIN job_gpu_metrics g ON g.job_id = j.job_id::text
      CROSS JOIN LATERAL (
        SELECT d::date AS day,
               EXTRACT(EPOCH FROM LEAST(j.end_time, (d + interval '1 day') AT TIME ZONE $2)
                                - GREATEST(j.start_time, d AT TIME ZONE $2)) AS secs
        FROM generate_series(date_trunc('day', j.start_time AT TIME ZONE $2), j.end_time AT TIME ZONE $2, interval '1 day') AS d
      ) s
      WHERE j.end_time >= (SELECT lo FROM b) AND j.end_time < (SELECT hi FROM b) + make_interval(secs => $3::float8)
        AND j.start_time < (SELECT hi FROM b) AND s.day = ANY($1::date[]) AND s.secs > 0
    ),
    daily AS (
      INSERT INTO job_daily (day, ${DIMS.join(", ")}, ${USAGE_COLS.join(", ")}, ${ENDED_COLS.join(", ")})
      SELECT day, ${DIMS.join(", ")}, ${sum(USAGE_COLS)}, ${sum(ENDED_COLS)}
      FROM (
        SELECT day, ${DIMS.join(", ")}, ${USAGE_COLS.join(", ")}, ${zero(ENDED_COLS)} FROM usage
        UNION ALL
        SELECT day, ${DIMS.join(", ")}, ${zero(USAGE_COLS)}, ${ENDED_COLS.join(", ")} FROM ended
      ) x
      GROUP BY day, ${DIMS.join(", ")}
      RETURNING 1
    ),
    hist AS (
      INSERT INTO job_daily_hist (day, cluster, partition, qos, account_id, user_id, kind, bin, w)
      SELECT day, cluster, partition, qos, account_id, user_id, h.kind, h.bin, SUM(h.w)
      FROM ended
      CROSS JOIN LATERAL (VALUES
        (${HIST.wait}, wait_bin, 1.0),
        (${HIST.wallUsed}, wall_used_bin, 1.0),
        (${HIST.cpuEff}, cpu_bin, cpu_hours),
        (${HIST.memEff}, mem_bin, 1.0),
        (${HIST.gpuEff}, gpu_bin, gpu_hours)
      ) AS h(kind, bin, w)
      WHERE h.bin IS NOT NULL
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
      RETURNING 1
    )
    SELECT to_char(day, 'YYYY-MM-DD') AS day, cluster, partition, qos, node_list,
           COUNT(*) AS jobs, COUNT(*) FILTER (WHERE state = 'PREEMPTED') AS preempted,
           (SELECT COUNT(*) FROM daily) AS daily_rows, (SELECT COUNT(*) FROM hist) AS hist_rows
    FROM ended
    WHERE COALESCE(node_list, '') NOT IN ('', 'None assigned')
    GROUP BY 1, 2, 3, 4, 5`;
}

interface NodeRow {
  day: string;
  cluster: string;
  partition: string | null;
  qos: string | null;
  node_list: string;
  jobs: unknown;
  preempted: unknown;
}

async function recompute(pool: DbPool, days: string[], timeZone: string, maxJobSeconds: number, totalCpu: boolean) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Locks these days, so the ingestor marking one again waits for this
    // transaction and the day is recomputed once more after it
    await client.query("DELETE FROM metrics_rollup_dirty WHERE day = ANY($1::date[])", [days]);
    for (const table of ["job_daily", "job_daily_hist", "job_daily_nodes"]) {
      await client.query(`DELETE FROM ${table} WHERE day = ANY($1::date[])`, [days]);
    }
    const { rows } = await client.query(computeSql(totalCpu), [days, timeZone, maxJobSeconds]);

    const byNode = new Map<string, { day: string; cluster: string; partition: string | null; qos: string | null; node: string; jobs: number; preempted: number }>();
    // Node "" holds each day's totals, counting a job once however many nodes it ran on
    for (const r of rows as NodeRow[]) {
      for (const node of ["", ...expandHostlist(r.node_list)]) {
        const key = JSON.stringify([r.day, r.cluster, r.partition, r.qos, node]);
        const entry = byNode.get(key) ?? { day: r.day, cluster: r.cluster, partition: r.partition, qos: r.qos, node, jobs: 0, preempted: 0 };
        entry.jobs += num(r.jobs);
        entry.preempted += num(r.preempted);
        byNode.set(key, entry);
      }
    }
    const entries = [...byNode.values()];
    for (let i = 0; i < entries.length; i += 5000) {
      const batch = entries.slice(i, i + 5000);
      await client.query(
        `INSERT INTO job_daily_nodes (day, cluster, partition, qos, node, jobs, preempted)
         SELECT * FROM unnest($1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[])`,
        [
          batch.map((e) => e.day),
          batch.map((e) => e.cluster),
          batch.map((e) => e.partition),
          batch.map((e) => e.qos),
          batch.map((e) => e.node),
          batch.map((e) => e.jobs),
          batch.map((e) => e.preempted),
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Start over: empty the rollups and mark every day with jobs, through
// tomorrow so jobs written while this runs are covered
async function rebuild(pool: DbPool, definition: string, timeZone: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE job_daily, job_daily_hist, job_daily_nodes, metrics_rollup_dirty");
    const { rows } = await client.query(
      `INSERT INTO metrics_rollup_state (id, definition, time_zone, ready, max_job_seconds, updated_at)
       SELECT 1, $1, $2, false,
              (SELECT COALESCE(max(EXTRACT(EPOCH FROM end_time - start_time)), 0)::bigint FROM job_history), now()
       ON CONFLICT (id) DO UPDATE SET definition = EXCLUDED.definition, time_zone = EXCLUDED.time_zone, ready = false,
         max_job_seconds = EXCLUDED.max_job_seconds, updated_at = now()
       RETURNING max_job_seconds`,
      [definition, timeZone]
    );
    const maxDays = Math.ceil(num(rows[0]?.max_job_seconds) / 86400);
    const marked = await client.query(
      `INSERT INTO metrics_rollup_dirty (day)
       SELECT d::date FROM generate_series(
         ((SELECT min(end_time) FROM job_history) AT TIME ZONE $1)::date - $2::int,
         $3::date, interval '1 day') AS d`,
      [timeZone, maxDays, addDays(todayIn(timeZone), 1)]
    );
    await client.query("COMMIT");
    return marked.rowCount ?? 0;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const globalForRollups = globalThis as unknown as { slurmdashRollupTriggers?: boolean; slurmdashRollupRefresh?: number };

// One collector run: set up, then recompute marked days, newest first, for up
// to budgetMs
export async function maintainRollups(pool: DbPool, opts: { timeZone: string; totalCpu: boolean; budgetMs: number }) {
  const started = Date.now();
  if (!globalForRollups.slurmdashRollupTriggers) {
    await ensureTriggers(pool);
    globalForRollups.slurmdashRollupTriggers = true;
  }

  const definition = `${DEFINITION}:${opts.totalCpu ? "cpu" : "nocpu"}`;
  let { rows } = await pool.query("SELECT definition, time_zone, ready, max_job_seconds FROM metrics_rollup_state WHERE id = 1");
  if (rows[0]?.definition !== definition || rows[0]?.time_zone !== opts.timeZone) {
    const marked = await rebuild(pool, definition, opts.timeZone);
    console.log(`[collectors] metrics rollups: building ${marked} days in ${opts.timeZone}`);
    ({ rows } = await pool.query("SELECT definition, time_zone, ready, max_job_seconds FROM metrics_rollup_state WHERE id = 1"));
  }
  const ready = Boolean(rows[0]?.ready);

  // GPU history can land after a job's rollup; redo the last two days hourly
  if (Date.now() - (globalForRollups.slurmdashRollupRefresh ?? 0) > 3_600_000) {
    globalForRollups.slurmdashRollupRefresh = Date.now();
    const today = todayIn(opts.timeZone);
    await pool.query("INSERT INTO metrics_rollup_dirty (day) VALUES ($1), ($2) ON CONFLICT DO NOTHING", [addDays(today, -1), today]);
  }

  let done = 0;
  while (Date.now() - started < opts.budgetMs) {
    const state = await pool.query("SELECT max_job_seconds FROM metrics_rollup_state WHERE id = 1");
    const { rows: pick } = await pool.query(
      `SELECT array_agg(to_char(day, 'YYYY-MM-DD') ORDER BY day) AS days
       FROM metrics_rollup_dirty
       WHERE day > (SELECT max(day) FROM metrics_rollup_dirty) - $1::int`,
      [CHUNK_DAYS]
    );
    const days: string[] | null = pick[0]?.days;
    if (!days?.length) break;
    await recompute(pool, days, opts.timeZone, num(state.rows[0]?.max_job_seconds), opts.totalCpu);
    done += days.length;
  }

  const { rows: left } = await pool.query("SELECT COUNT(*) AS n FROM metrics_rollup_dirty");
  const remaining = num(left[0]?.n);
  if (!ready) {
    if (remaining === 0) {
      await pool.query("UPDATE metrics_rollup_state SET ready = true, updated_at = now() WHERE id = 1");
      console.log(`[collectors] metrics rollups: ready (${Math.round((Date.now() - started) / 1000)} s for the last ${done} days)`);
    } else if (done > 0) {
      console.log(`[collectors] metrics rollups: ${done} days built, ${remaining} to go`);
    }
  }
}
