import { expandHostlist } from "@/lib/metrics/hostlist";
import { hasListFilters } from "@/lib/metrics/params";
import { daysIn } from "@/lib/metrics/rollup";
import { Params, STATE_SQL, endedIn, filterConditions, num, where, type MetricsContext, type Queryable } from "@/lib/metrics/sql";

// Preemption per node, from finished jobs' node lists. Jobs that share a node
// list are counted together in SQL, then the lists are expanded here.

type ListRow = { node_list: string; jobs: unknown; preempted: unknown };

export interface NodePreemption {
  node: string;
  jobs: number;
  preempted: number;
}

function tally(rows: ListRow[], only?: string): Map<string, NodePreemption> {
  const byNode = new Map<string, NodePreemption>();
  for (const r of rows) {
    for (const node of expandHostlist(r.node_list)) {
      if (only && node !== only) continue;
      const entry = byNode.get(node) ?? { node, jobs: 0, preempted: 0 };
      entry.jobs += num(r.jobs);
      entry.preempted += num(r.preempted);
      byNode.set(node, entry);
    }
  }
  return byNode;
}

export interface PreemptionSummary {
  // Nodes with the most preempted jobs, at most `limit`
  nodes: NodePreemption[];
  preempted: number;
  jobs: number;
}

export async function getPreemptionByNode(db: Queryable, ctx: MetricsContext, limit = 10): Promise<PreemptionSummary> {
  // The rollups keep nodes by cluster, partition and QoS only
  if (ctx.rollup && !hasListFilters(ctx.filters, ["clusters", "partitions", "qos"])) {
    const p = new Params();
    const { rows } = await db.query(
      `SELECT j.node, SUM(j.jobs) AS jobs, SUM(j.preempted) AS preempted
       FROM job_daily_nodes j
       ${where([daysIn(ctx, p), ...filterConditions(ctx.filters, p)])}
       GROUP BY 1`,
      p.values
    );
    const totals = rows.find((r) => r.node === "");
    const nodes = rows
      .filter((r) => r.node !== "" && num(r.preempted) > 0)
      .map((r) => ({ node: r.node as string, jobs: num(r.jobs), preempted: num(r.preempted) }));
    return {
      nodes: nodes.sort((a, b) => b.preempted - a.preempted || b.jobs - a.jobs).slice(0, limit),
      preempted: num(totals?.preempted),
      jobs: num(totals?.jobs),
    };
  }
  const p = new Params();
  const from = p.add(ctx.range.from);
  const to = p.add(ctx.range.to);
  const { rows } = await db.query(
    `SELECT j.node_list, COUNT(*) AS jobs, COUNT(*) FILTER (WHERE ${STATE_SQL} = 'PREEMPTED') AS preempted
     FROM job_history j
     ${where([endedIn(from, to), "COALESCE(j.node_list, '') NOT IN ('', 'None assigned')", ...filterConditions(ctx.filters, p)])}
     GROUP BY j.node_list`,
    p.values
  );
  const lists = rows as ListRow[];
  const nodes = [...tally(lists).values()];
  const preempted = lists.reduce((s, r) => s + num(r.preempted), 0);
  const jobs = lists.reduce((s, r) => s + num(r.jobs), 0);
  return {
    nodes: nodes.filter((n) => n.preempted > 0).sort((a, b) => b.preempted - a.preempted || b.jobs - a.jobs).slice(0, limit),
    preempted,
    jobs,
  };
}

// One node over the last `days`: jobs that ran on it and how many were preempted
export async function getNodePreemption(db: Queryable, cluster: string, node: string, days: number): Promise<NodePreemption> {
  // Lists that could include the node start with its name's letters ("cn" for cn012)
  const prefix = node.match(/^[^0-9[\]]*/)?.[0] ?? "";
  const { rows } = await db.query(
    `SELECT j.node_list, COUNT(*) AS jobs, COUNT(*) FILTER (WHERE ${STATE_SQL} = 'PREEMPTED') AS preempted
     FROM job_history j
     WHERE j.cluster = $1 AND j.end_time > now() - make_interval(days => $2)
       AND (j.node_list = $3 OR j.node_list LIKE $4)
     GROUP BY j.node_list`,
    [cluster, days, node, `%${prefix.replace(/[\\%_]/g, "\\$&")}%`]
  );
  return tally(rows as ListRow[], node).get(node) ?? { node, jobs: 0, preempted: 0 };
}
