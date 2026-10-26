import type { DbPool } from "@/lib/db";
import { nodeState, type NodeState } from "@/lib/node-history";
import type { SlurmNode } from "@/lib/nodes";
import { parseGPUResources } from "@/utils/gpu-parse";

// Hourly CPU, GPU and node capacity per cluster, for utilization on the
// metrics page: how many core-, GPU- and node-seconds the cluster had, how
// many of those were on nodes that could run jobs, and how many were
// allocated (for nodes, running at least one job). Recorded by the node
// history collector from the same nodes fetch.

// Nodes in these states can't run jobs, so their CPUs and GPUs aren't
// available. A draining node still runs its jobs and counts as available.
const UNAVAILABLE: ReadonlySet<NodeState> = new Set(["down", "maintenance", "drained", "powered_down"]);
const RUNNING_JOBS: ReadonlySet<NodeState> = new Set(["allocated", "mixed", "draining"]);

export interface CapacityCounts {
  cpuTotal: number;
  cpuAvailable: number;
  cpuAllocated: number;
  gpuTotal: number;
  gpuAvailable: number;
  gpuAllocated: number;
  nodeTotal: number;
  nodeAvailable: number;
  nodeAllocated: number;
}

function count(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  // Slurm 23.11+ wraps some numbers as { set, infinite, number }
  if (value && typeof value === "object" && "number" in value) return count((value as { number?: unknown }).number);
  return 0;
}

// CPUs, GPUs and nodes right now. Allocations on unavailable nodes are left
// out so allocated never exceeds available.
export function capacityCounts(nodes: SlurmNode[]): CapacityCounts {
  const c: CapacityCounts = {
    cpuTotal: 0,
    cpuAvailable: 0,
    cpuAllocated: 0,
    gpuTotal: 0,
    gpuAvailable: 0,
    gpuAllocated: 0,
    nodeTotal: 0,
    nodeAvailable: 0,
    nodeAllocated: 0,
  };
  for (const node of nodes) {
    const cpus = count(node.cpus);
    const gres = typeof node.gres === "string" ? node.gres : "";
    const { gpuTotal, gpuUsed } = gres
      ? parseGPUResources(gres, typeof node.gres_used === "string" ? node.gres_used : "")
      : { gpuTotal: 0, gpuUsed: 0 };
    const state = nodeState(node);
    c.cpuTotal += cpus;
    c.gpuTotal += gpuTotal;
    c.nodeTotal += 1;
    if (UNAVAILABLE.has(state)) continue;
    c.cpuAvailable += cpus;
    c.cpuAllocated += Math.min(count(node.alloc_cpus), cpus);
    c.gpuAvailable += gpuTotal;
    c.gpuAllocated += Math.min(gpuUsed, gpuTotal);
    c.nodeAvailable += 1;
    if (RUNNING_JOBS.has(state)) c.nodeAllocated += 1;
  }
  return c;
}

// Add the seconds since the last check to this hour's totals
export async function recordClusterCapacity(
  pool: DbPool,
  cluster: string,
  nodes: SlurmNode[],
  seconds: number,
  now = new Date()
) {
  if (nodes.length === 0 || seconds <= 0) return;
  const c = capacityCounts(nodes);
  const s = (n: number) => Math.round(n * seconds);
  await pool.query(
    `INSERT INTO cluster_capacity (cluster, hour, cpu_seconds_total, cpu_seconds_available, cpu_seconds_allocated,
                                   gpu_seconds_total, gpu_seconds_available, gpu_seconds_allocated,
                                   node_seconds_total, node_seconds_available, node_seconds_allocated)
     VALUES ($1, date_trunc('hour', $2::timestamptz), $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (cluster, hour) DO UPDATE SET
       cpu_seconds_total = cluster_capacity.cpu_seconds_total + EXCLUDED.cpu_seconds_total,
       cpu_seconds_available = cluster_capacity.cpu_seconds_available + EXCLUDED.cpu_seconds_available,
       cpu_seconds_allocated = cluster_capacity.cpu_seconds_allocated + EXCLUDED.cpu_seconds_allocated,
       gpu_seconds_total = cluster_capacity.gpu_seconds_total + EXCLUDED.gpu_seconds_total,
       gpu_seconds_available = cluster_capacity.gpu_seconds_available + EXCLUDED.gpu_seconds_available,
       gpu_seconds_allocated = cluster_capacity.gpu_seconds_allocated + EXCLUDED.gpu_seconds_allocated,
       node_seconds_total = COALESCE(cluster_capacity.node_seconds_total, 0) + EXCLUDED.node_seconds_total,
       node_seconds_available = COALESCE(cluster_capacity.node_seconds_available, 0) + EXCLUDED.node_seconds_available,
       node_seconds_allocated = COALESCE(cluster_capacity.node_seconds_allocated, 0) + EXCLUDED.node_seconds_allocated`,
    [
      cluster,
      now,
      s(c.cpuTotal),
      s(c.cpuAvailable),
      s(c.cpuAllocated),
      s(c.gpuTotal),
      s(c.gpuAvailable),
      s(c.gpuAllocated),
      s(c.nodeTotal),
      s(c.nodeAvailable),
      s(c.nodeAllocated),
    ]
  );
}

export async function pruneClusterCapacity(pool: DbPool, cluster: string, days: number): Promise<number> {
  const result = await pool.query(
    "DELETE FROM cluster_capacity WHERE cluster = $1 AND hour < now() - make_interval(days => $2)",
    [cluster, days]
  );
  return result.rowCount ?? 0;
}
