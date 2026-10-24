import type { DbPool } from "@/lib/db";
import type { SlurmNode } from "@/lib/nodes";

// Node history records the periods a node was unavailable: drained, down,
// failed, not responding or in maintenance, with Slurm's reason. Busy/idle
// changes and power saving aren't recorded.
export const UNAVAILABLE_FLAGS = [
  "DOWN",
  "DRAIN",
  "FAIL",
  "ERROR",
  "NOT_RESPONDING",
  "MAINTENANCE",
  "REBOOT_ISSUED",
  "INVALID_REG",
];

export interface NodeCondition {
  node: string;
  state: string; // unavailable flags, e.g. "DRAIN" or "DOWN+NOT_RESPONDING"
  reason: string | null;
  setBy: string | null;
  since: Date | null; // when Slurm says the reason was set
}

export interface OpenNodeEvent {
  id: number;
  node: string;
  state: string;
  reason: string | null;
  startedAt: Date;
}

// Slurm 23.11+ wraps numbers as { set, infinite, number }; older APIs send
// plain numbers
function slurmNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "number" in value) {
    const n = (value as { number?: unknown; set?: boolean }).number;
    if ((value as { set?: boolean }).set === false) return null;
    return typeof n === "number" ? n : null;
  }
  return null;
}

function nodeFlags(node: SlurmNode): string[] {
  const state = node.state;
  const flags = Array.isArray(state) ? state : typeof state === "string" ? state.split("+") : [];
  const extra = Array.isArray(node.state_flags) ? node.state_flags : [];
  return [...flags, ...extra].map((f: string) => String(f).toUpperCase());
}

export function nodeCondition(node: SlurmNode, now: Date): NodeCondition | null {
  const flags = new Set(nodeFlags(node));
  const unavailable = UNAVAILABLE_FLAGS.filter((f) => flags.has(f));
  if (unavailable.length === 0) return null;

  const changedAt = slurmNumber(node.reason_changed_at);
  // Ignore a missing or future timestamp rather than trusting it
  const since =
    changedAt && changedAt > 0 && changedAt * 1000 <= now.getTime() + 60_000 ? new Date(changedAt * 1000) : null;

  return {
    node: node.name ?? node.hostname ?? "",
    state: unavailable.join("+"),
    reason: node.reason ? String(node.reason) : null,
    setBy: node.reason_set_by_user ? String(node.reason_set_by_user) : null,
    since,
  };
}

export interface NodeEventPlan {
  close: { id: number; endedAt: Date }[];
  open: (NodeCondition & { startedAt: Date })[];
}

// Compare the open periods with the nodes' current conditions. A node that's
// available again, or gone from Slurm, has its period closed; a new state or
// reason closes the old period and opens a new one.
export function planNodeEvents(
  openEvents: OpenNodeEvent[],
  current: Map<string, NodeCondition | null>,
  now: Date
): NodeEventPlan {
  const plan: NodeEventPlan = { close: [], open: [] };
  const openByNode = new Map(openEvents.map((e) => [e.node, e]));
  const closedAt = new Map<string, Date>();

  for (const event of openEvents) {
    const condition = current.get(event.node) ?? null;
    if (condition && condition.state === event.state && condition.reason === event.reason) continue;

    // Slurm's timestamp for the new reason is when the old period ended
    const end = condition?.since && condition.since > event.startedAt ? condition.since : now;
    plan.close.push({ id: event.id, endedAt: end });
    closedAt.set(event.node, end);
  }

  for (const [node, condition] of current) {
    if (!condition) continue;
    const existing = openByNode.get(node);
    if (existing && existing.state === condition.state && existing.reason === condition.reason) continue;
    // A replacement starts where the period it replaces ended, so they never overlap
    plan.open.push({ ...condition, startedAt: closedAt.get(node) ?? condition.since ?? now });
  }

  return plan;
}

export async function recordNodeEvents(pool: DbPool, cluster: string, nodes: SlurmNode[], now = new Date()) {
  const current = new Map<string, NodeCondition | null>();
  for (const node of nodes) {
    const name = node.name ?? node.hostname;
    if (name) current.set(name, nodeCondition(node, now));
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, node, state, reason, started_at FROM node_events
       WHERE cluster = $1 AND ended_at IS NULL FOR UPDATE`,
      [cluster]
    );
    const openEvents: OpenNodeEvent[] = rows.map((r: { id: string; node: string; state: string; reason: string | null; started_at: Date }) => ({
      id: Number(r.id),
      node: r.node,
      state: r.state,
      reason: r.reason,
      startedAt: new Date(r.started_at),
    }));

    const plan = planNodeEvents(openEvents, current, now);
    for (const c of plan.close) {
      await client.query("UPDATE node_events SET ended_at = $2 WHERE id = $1", [c.id, c.endedAt]);
    }
    for (const o of plan.open) {
      await client.query(
        `INSERT INTO node_events (cluster, node, state, reason, reason_set_by, started_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [cluster, o.node, o.state, o.reason, o.setBy, o.startedAt]
      );
    }
    await client.query("COMMIT");
    return plan;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface NodeHistoryEntry {
  state: string;
  reason: string | null;
  setBy: string | null;
  startedAt: string;
  endedAt: string | null;
}

export async function getNodeHistory(
  pool: DbPool,
  cluster: string,
  node: string,
  days: number
): Promise<NodeHistoryEntry[]> {
  const { rows } = await pool.query(
    `SELECT state, reason, reason_set_by, started_at, ended_at FROM node_events
     WHERE cluster = $1 AND node = $2
       AND (ended_at IS NULL OR ended_at > now() - make_interval(days => $3))
     ORDER BY started_at DESC
     LIMIT 200`,
    [cluster, node, days]
  );
  return rows.map((r: { state: string; reason: string | null; reason_set_by: string | null; started_at: Date; ended_at: Date | null }) => ({
    state: r.state,
    reason: r.reason,
    setBy: r.reason_set_by,
    startedAt: new Date(r.started_at).toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
  }));
}
