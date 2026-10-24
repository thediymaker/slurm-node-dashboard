import { expandHostlist } from "@/lib/metrics/hostlist";
import { parseJobQuery } from "@/lib/metrics/job-query";
import {
  ACCOUNT_ORG_CTE,
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

// The Jobs tab: search finished jobs and look one up

export const JOBS_PAGE_SIZE = 50;
// A node search can't be done exactly in SQL (node lists are compressed
// hostlists), so candidates are checked here; at most this many
const NODE_CANDIDATES = 2_000;

export interface JobRow {
  key: string; // job_id:submit epoch, the job's identity in links
  jobId: string;
  cluster: string;
  name: string | null;
  state: string;
  user: string | null;
  account: string | null;
  partition: string | null;
  endTime: string | null;
  cpuHours: number;
  gpuCount: number;
  cpuEfficiency: number | null; // 0-1
  nodeList: string | null;
}

export interface JobSearchResult {
  jobs: JobRow[];
  total: number;
  // The node search hit NODE_CANDIDATES, so total may be low
  truncated: boolean;
  // Terms that couldn't be applied, e.g. eff< without CPU time data
  ignored: string[];
  // ID searches look at every date
  allDates: boolean;
}

const cpuEff = (ctx: MetricsContext) =>
  ctx.totalCpu
    ? `CASE WHEN j.run_time_seconds >= 60 AND j.req_cpus > 0 AND j.total_cpu_seconds IS NOT NULL
            THEN LEAST(j.total_cpu_seconds / (j.run_time_seconds::numeric * j.req_cpus), 1) END`
    : "NULL::numeric";

const STATE_ALIASES: Record<string, string> = { oom: "OUT_OF_MEMORY", timeout: "TIMEOUT", cancel: "CANCELLED" };

export async function searchJobs(db: Queryable, ctx: MetricsContext, q: string, page: number): Promise<JobSearchResult> {
  const query = parseJobQuery(q);
  const p = new Params();
  const conditions = filterConditions(ctx.filters, p);
  const ignored: string[] = [];

  const allDates = query.ids.length > 0;
  if (query.date) {
    const d = p.add(query.date);
    const tz = p.add(ctx.timeZone);
    conditions.push(
      `j.end_time >= (${d}::date)::timestamp AT TIME ZONE ${tz}`,
      `j.end_time < ((${d}::date) + 1)::timestamp AT TIME ZONE ${tz}`
    );
  } else if (!allDates) {
    conditions.push(endedIn(p.add(ctx.range.from), p.add(ctx.range.to)));
  }
  if (query.ids.length) {
    const ids = p.add(query.ids);
    conditions.push(`(j.job_id = ANY(${ids}::bigint[]) OR j.array_job_id::bigint = ANY(${ids}::bigint[]))`);
  }
  const lower = (values: string[]) => p.add(values.map((v) => v.toLowerCase()));
  if (query.users.length) conditions.push(`lower(u.name) = ANY(${lower(query.users)}::text[])`);
  if (query.accounts.length) conditions.push(`lower(a.name) = ANY(${lower(query.accounts)}::text[])`);
  if (query.partitions.length) conditions.push(`lower(j.partition) = ANY(${lower(query.partitions)}::text[])`);
  if (query.qos.length) conditions.push(`lower(j.qos) = ANY(${lower(query.qos)}::text[])`);
  if (query.clusters.length) conditions.push(`lower(j.cluster) = ANY(${lower(query.clusters)}::text[])`);
  if (query.states.length) {
    const patterns = query.states.map((s) => `${STATE_ALIASES[s.toLowerCase()] ?? s}%`);
    conditions.push(`${STATE_SQL} ILIKE ANY(${p.add(patterns)}::text[])`);
  }
  if (query.names.length) conditions.push(`j.job_name ILIKE ALL(${p.add(query.names.map((n) => `%${n}%`))}::text[])`);
  if (query.gpu !== undefined) conditions.push(query.gpu ? "j.gpu_count > 0" : "COALESCE(j.gpu_count, 0) = 0");
  if (query.effBelow !== undefined) {
    if (ctx.totalCpu) conditions.push(`(${cpuEff(ctx)}) < ${p.add(query.effBelow / 100)}`);
    else ignored.push(`eff<${query.effBelow}`);
  }
  // Candidates: the node's name without its number appears in the list
  if (query.nodes.length) {
    for (const node of query.nodes) {
      const stem = node.replace(/\d+$/, "") || node;
      conditions.push(`j.node_list ILIKE ${p.add(`%${stem.replace(/[\\%_]/g, "\\$&")}%`)}`);
    }
  }

  const byNode = query.nodes.length > 0;
  const limit = byNode ? NODE_CANDIDATES : JOBS_PAGE_SIZE;
  const offset = byNode ? 0 : (page - 1) * JOBS_PAGE_SIZE;
  const { rows } = await db.query(
    `SELECT j.job_id, j.cluster, FLOOR(EXTRACT(EPOCH FROM j.submit_time))::bigint AS submit_epoch, j.job_name,
            ${STATE_SQL} AS state, u.name AS user_name, a.name AS account, j.partition, j.end_time,
            COALESCE(j.req_cpus, 0) * COALESCE(j.run_time_seconds, 0) / 3600.0 AS cpu_hours,
            COALESCE(j.gpu_count, 0) AS gpu_count, ${cpuEff(ctx)} AS cpu_eff, j.node_list,
            COUNT(*) OVER () AS total
     FROM job_history j
     LEFT JOIN users u ON u.id = j.user_id
     LEFT JOIN accounts a ON a.id = j.account_id
     ${where(conditions)}
     ORDER BY j.end_time DESC NULLS LAST, j.job_id DESC
     LIMIT ${p.add(limit)} OFFSET ${p.add(offset)}`,
    p.values
  );

  let jobs = rows.map(toRow);
  let total = num(rows[0]?.total);
  let truncated = false;
  if (byNode) {
    truncated = total > NODE_CANDIDATES;
    const wanted = query.nodes.map((n) => n.toLowerCase());
    jobs = jobs.filter((j) => {
      const hosts = expandHostlist(j.nodeList).map((h) => h.toLowerCase());
      return wanted.every((w) => hosts.includes(w));
    });
    total = jobs.length;
    jobs = jobs.slice((page - 1) * JOBS_PAGE_SIZE, page * JOBS_PAGE_SIZE);
  }
  return { jobs, total, truncated, ignored, allDates };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any): JobRow {
  return {
    key: `${r.job_id}:${r.submit_epoch}`,
    jobId: String(r.job_id),
    cluster: r.cluster,
    name: r.job_name,
    state: r.state,
    user: r.user_name,
    account: r.account,
    partition: r.partition,
    endTime: r.end_time ? new Date(r.end_time).toISOString() : null,
    cpuHours: num(r.cpu_hours),
    gpuCount: num(r.gpu_count),
    cpuEfficiency: numOrNull(r.cpu_eff),
    nodeList: r.node_list,
  };
}

export interface JobDetail extends JobRow {
  qos: string | null;
  department: string | null;
  college: string | null;
  group: string | null;
  arrayJobId: string | null;
  arrayTaskId: number | null;
  submitTime: string;
  startTime: string | null;
  waitSeconds: number | null;
  runSeconds: number | null;
  timeLimitMinutes: number | null;
  reqCpus: number | null;
  reqNodes: number | null;
  reqMemMb: number | null;
  maxRssBytes: number | null;
  totalCpuSeconds: number | null;
  gpuHours: number;
  exitCode: number | null;
  exitState: string | null;
  tresAlloc: string | null;
  tresReq: string | null;
  gpu: { avgUtilization: number; maxUtilization: number; avgMemory: number } | null;
}

// key is "<job id>" (the latest job with that ID) or "<job id>:<submit epoch>"
export async function getJobDetail(db: Queryable, ctx: MetricsContext, key: string): Promise<JobDetail | null> {
  const m = key.match(/^(\d+)(?::(\d+))?$/);
  if (!m) return null;
  const p = new Params();
  const conditions = [`j.job_id = ${p.add(m[1])}::bigint`];
  if (m[2]) {
    const submit = p.add(m[2]);
    conditions.push(`j.submit_time >= to_timestamp(${submit}::bigint)`, `j.submit_time < to_timestamp(${submit}::bigint + 1)`);
  }
  if (ctx.filters.clusters.length) conditions.push(`j.cluster = ANY(${p.add(ctx.filters.clusters)}::text[])`);
  const gpu = ctx.gpuHistory;
  const { rows } = await db.query(
    `WITH ${ACCOUNT_ORG_CTE}
     SELECT j.job_id, j.cluster, FLOOR(EXTRACT(EPOCH FROM j.submit_time))::bigint AS submit_epoch, j.job_name,
            ${STATE_SQL} AS state, u.name AS user_name, a.name AS account, j.partition, j.qos,
            org.department, org.college, j.group_name, j.array_job_id, j.array_task_id,
            j.submit_time, j.start_time, j.end_time, j.wait_time_seconds, j.run_time_seconds, j.timelimit_minutes,
            j.req_cpus, j.req_nodes, ${REQ_MEM_MB_SQL} AS req_mem_mb, NULLIF(j.max_rss, 0) AS max_rss,
            ${ctx.totalCpu ? "j.total_cpu_seconds" : "NULL::bigint"} AS total_cpu_seconds,
            COALESCE(j.req_cpus, 0) * COALESCE(j.run_time_seconds, 0) / 3600.0 AS cpu_hours,
            COALESCE(j.gpu_count, 0) AS gpu_count,
            COALESCE(j.gpu_count, 0) * COALESCE(j.run_time_seconds, 0) / 3600.0 AS gpu_hours,
            ${cpuEff(ctx)} AS cpu_eff, j.node_list, j.exit_code, j.derived_exit_state,
            j.tres_alloc_str, j.tres_req_str
            ${gpu ? ", g.avg_utilization, g.max_utilization, g.avg_memory_pct" : ""}
     FROM job_history j
     LEFT JOIN users u ON u.id = j.user_id
     LEFT JOIN accounts a ON a.id = j.account_id
     LEFT JOIN acct_org org ON org.account_id = j.account_id
     ${gpu ? "LEFT JOIN job_gpu_metrics g ON g.job_id = j.job_id::text" : ""}
     ${where(conditions)}
     ORDER BY j.submit_time DESC
     LIMIT 1`,
    p.values
  );
  const r = rows[0];
  if (!r) return null;
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    ...toRow(r),
    qos: r.qos,
    department: r.department,
    college: r.college,
    group: r.group_name,
    arrayJobId: r.array_job_id === null || r.array_job_id === undefined ? null : String(r.array_job_id),
    arrayTaskId: numOrNull(r.array_task_id),
    submitTime: iso(r.submit_time)!,
    startTime: iso(r.start_time),
    waitSeconds: numOrNull(r.wait_time_seconds),
    runSeconds: numOrNull(r.run_time_seconds),
    timeLimitMinutes: numOrNull(r.timelimit_minutes),
    reqCpus: numOrNull(r.req_cpus),
    reqNodes: numOrNull(r.req_nodes),
    reqMemMb: numOrNull(r.req_mem_mb),
    maxRssBytes: numOrNull(r.max_rss),
    totalCpuSeconds: numOrNull(r.total_cpu_seconds),
    gpuHours: num(r.gpu_hours),
    exitCode: numOrNull(r.exit_code),
    exitState: r.derived_exit_state,
    tresAlloc: r.tres_alloc_str || null,
    tresReq: r.tres_req_str || null,
    gpu:
      gpu && r.avg_utilization !== null && r.avg_utilization !== undefined
        ? { avgUtilization: num(r.avg_utilization), maxUtilization: num(r.max_utilization), avgMemory: num(r.avg_memory_pct) }
        : null,
  };
}
