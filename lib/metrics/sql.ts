import type { ListFilter, MetricsFilters, Period } from "@/lib/metrics/params";

// Building blocks the metrics queries share. Every value goes in as a
// parameter; only validated enums (period, column choices) are inlined.
//
// Two ways a job counts toward a range:
// - usage (CPU, GPU and node hours, active users, utilization) is spread over
//   the time the job ran, so a week-long job adds to every day of that week
//   and a range gets only the part that fell inside it
// - per-job figures (job counts, waits, wall time, efficiency, outcomes)
//   count the jobs that ended in the range, in the period they ended

export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

// The resolved date range: whole days in the metrics time zone
export interface MetricsRange {
  from: Date;
  to: Date; // exclusive
  prevFrom: Date; // the previous range of the same length ends at from
  fromDate: string;
  toDate: string; // inclusive
  prevFromDate: string;
  // Every period bucket in the range, as YYYY-MM-DD of its first day
  buckets: string[];
}

// What the queries need besides the filters
export interface MetricsContext {
  filters: MetricsFilters;
  range: MetricsRange;
  period: Period;
  timeZone: string;
  // job_history.total_cpu_seconds exists (slurm-history-ingestor 1.1+)
  totalCpu: boolean;
  // GPU history is on, so job_gpu_metrics holds finished jobs' utilization
  gpuHistory: boolean;
  // cluster_capacity exists
  capacity: boolean;
  // The daily rollups are built in this time zone (lib/metrics/rollup.ts);
  // otherwise queries read job_history
  rollup: boolean;
}

export class Params {
  values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

export const PERIOD_STEP: Record<Period, string> = {
  day: "1 day",
  week: "7 days",
  month: "1 month",
  quarter: "3 months",
  year: "1 year",
};

// Bucket key (YYYY-MM-DD of the bucket's first day) for a timestamptz
// expression, in the metrics time zone
export function bucketOf(expr: string, period: Period, tz: string): string {
  return `to_char(date_trunc('${period}', (${expr}) AT TIME ZONE ${tz}), 'YYYY-MM-DD')`;
}

// Job state without sacct's "by <uid>" and flag suffixes
export const STATE_SQL = `regexp_replace(split_part(j.job_state, ' ', 1), '\\+$', '')`;

export const FAILED_STATES = ["FAILED", "TIMEOUT", "OUT_OF_MEMORY", "NODE_FAIL", "BOOT_FAIL", "DEADLINE"];

// Requested memory in MB: the mem= part of the allocated TRES (MB in API
// mode, with a unit in sacct mode), else req_mem_mc
export const REQ_MEM_MB_SQL = `COALESCE(
  substring(j.tres_alloc_str from '(?:^|,)mem=([0-9.]+)')::numeric *
    CASE substring(j.tres_alloc_str from '(?:^|,)mem=[0-9.]+([KMGTP])')
      WHEN 'K' THEN 1.0 / 1024 WHEN 'G' THEN 1024 WHEN 'T' THEN 1048576 WHEN 'P' THEN 1073741824 ELSE 1 END,
  NULLIF(j.req_mem_mc, 0))`;

export const JOB_SIZE_BUCKETS = ["1", "2–4", "5–16", "17–64", "65–256", "257+"];
export const JOB_SIZE_SQL = `CASE
  WHEN COALESCE(j.req_cpus, 0) <= 1 THEN '1'
  WHEN j.req_cpus <= 4 THEN '2–4'
  WHEN j.req_cpus <= 16 THEN '5–16'
  WHEN j.req_cpus <= 64 THEN '17–64'
  WHEN j.req_cpus <= 256 THEN '65–256'
  ELSE '257+' END`;

export const WALL_TIME_BUCKETS = ["< 10 min", "10 min–1 h", "1–6 h", "6–24 h", "1–7 days", "> 7 days"];
export const WALL_TIME_SQL = `CASE
  WHEN COALESCE(j.run_time_seconds, 0) < 600 THEN '< 10 min'
  WHEN j.run_time_seconds < 3600 THEN '10 min–1 h'
  WHEN j.run_time_seconds < 21600 THEN '1–6 h'
  WHEN j.run_time_seconds < 86400 THEN '6–24 h'
  WHEN j.run_time_seconds < 604800 THEN '1–7 days'
  ELSE '> 7 days' END`;

// One department and college per account (the first mapping, if an account
// has several), so grouping by them never counts a job twice
export const ACCOUNT_ORG_CTE = `acct_org AS (
  SELECT DISTINCT ON (am.account_id) am.account_id, o.name AS department, p.name AS college
  FROM account_mappings am
  JOIN organizations o ON o.id = am.organization_id
  LEFT JOIN organizations p ON p.id = o.parent_id
  ORDER BY am.account_id, o.id
)`;

// The shared filters, except the date range, as conditions on job_history j.
// The hierarchy filters keep the semantics of the pre-tabs metrics page: a
// department is the organization an account maps to, a college its parent.
export function filterConditions(f: MetricsFilters, p: Params, except: ListFilter[] = []): string[] {
  const c: string[] = [];
  const on = (key: ListFilter) => f[key].length > 0 && !except.includes(key);
  if (on("clusters")) c.push(`j.cluster = ANY(${p.add(f.clusters)}::text[])`);
  if (on("partitions")) c.push(`j.partition = ANY(${p.add(f.partitions)}::text[])`);
  if (on("qos")) c.push(`j.qos = ANY(${p.add(f.qos)}::text[])`);
  if (on("accounts")) c.push(`j.account_id IN (SELECT id FROM accounts WHERE name = ANY(${p.add(f.accounts)}::text[]))`);
  if (on("users")) c.push(`j.user_id IN (SELECT id FROM users WHERE name = ANY(${p.add(f.users)}::text[]))`);
  if (on("departments")) {
    c.push(`j.account_id IN (
      SELECT am.account_id FROM account_mappings am JOIN organizations o ON am.organization_id = o.id
      WHERE o.name = ANY(${p.add(f.departments)}::text[]))`);
  }
  if (on("colleges")) {
    c.push(`j.account_id IN (
      SELECT am.account_id FROM account_mappings am
      JOIN organizations o ON am.organization_id = o.id
      JOIN organizations par ON o.parent_id = par.id
      WHERE par.name = ANY(${p.add(f.colleges)}::text[]))`);
  }
  return c;
}

// Jobs that ran at some point in [from, to)
export function ranIn(from: string, to: string): string {
  return `j.end_time >= ${from} AND j.start_time < ${to}`;
}

// Jobs that ended in [from, to)
export function endedIn(from: string, to: string): string {
  return `j.end_time >= ${from} AND j.end_time < ${to}`;
}

// Seconds of the job inside [from, to)
export function overlapSeconds(from: string, to: string): string {
  return `GREATEST(0, EXTRACT(EPOCH FROM LEAST(j.end_time, ${to}) - GREATEST(j.start_time, ${from})))`;
}

// A LATERAL that splits job j's run inside [from, to) into period buckets:
// one row per bucket with its key (bucket) and the job's seconds in it (secs)
export function usageBuckets(from: string, to: string, period: Period, tz: string): string {
  const step = `interval '${PERIOD_STEP[period]}'`;
  const ls = `(GREATEST(j.start_time, ${from}) AT TIME ZONE ${tz})`;
  const le = `(LEAST(j.end_time, ${to}) AT TIME ZONE ${tz})`;
  return `CROSS JOIN LATERAL (
    SELECT to_char(b, 'YYYY-MM-DD') AS bucket,
           EXTRACT(EPOCH FROM LEAST(${le}, b + ${step}) - GREATEST(${ls}, b)) AS secs
    FROM generate_series(date_trunc('${period}', ${ls}), ${le}, ${step}) AS b
  ) s`;
}

export function where(conditions: string[]): string {
  return conditions.length ? `WHERE ${conditions.join("\n  AND ")}` : "";
}

// Numbers come back from node-postgres as strings for numeric and bigint
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// The range as whole days in the metrics time zone, its previous range, and
// its period buckets
export async function resolveRange(
  db: Queryable,
  fromDate: string,
  toDate: string,
  period: Period,
  tz: string
): Promise<MetricsRange> {
  const p = new Params();
  const f = p.add(fromDate);
  const t = p.add(toDate);
  const zone = p.add(tz);
  const { rows } = await db.query(
    `SELECT (${f}::date)::timestamp AT TIME ZONE ${zone} AS from_ts,
            ((${t}::date) + 1)::timestamp AT TIME ZONE ${zone} AS to_ts,
            ((${f}::date) - ((${t}::date) - (${f}::date) + 1))::timestamp AT TIME ZONE ${zone} AS prev_from_ts,
            to_char((${f}::date) - ((${t}::date) - (${f}::date) + 1), 'YYYY-MM-DD') AS prev_from_date,
            ARRAY(SELECT to_char(b, 'YYYY-MM-DD')
                  FROM generate_series(date_trunc('${period}', (${f}::date)::timestamp), (${t}::date)::timestamp,
                                       interval '${PERIOD_STEP[period]}') AS b) AS buckets`,
    p.values
  );
  const r = rows[0];
  return {
    from: new Date(r.from_ts),
    to: new Date(r.to_ts),
    prevFrom: new Date(r.prev_from_ts),
    fromDate,
    toDate,
    prevFromDate: r.prev_from_date,
    buckets: r.buckets,
  };
}

// Today's date in the metrics time zone
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
