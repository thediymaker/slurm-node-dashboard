import { pruneClusterCapacity, recordClusterCapacity } from "@/lib/cluster-capacity";
import { readEnv } from "@/lib/config";
import { ensureSchema, getDb } from "@/lib/db";
import { getDatabaseStatus, getFeatures } from "@/lib/features";
import { EventLog, eventLogConfig, type EventLogConfig } from "@/lib/event-log";
import { handleCapture } from "@/lib/gpu-service";
import { pruneNodeHistory, recordNodeEvents, recordNodeStates } from "@/lib/node-history";
import { fetchNodesPayload, type NodesPayload } from "@/lib/nodes";
import { rememberSlurmClusterName } from "@/lib/slurm-cluster";
import { latestSnapshotTime, pruneSnapshots, saveSnapshot } from "@/lib/snapshots";

// Background work that replaces the pre-3.0 cron jobs: node history, Rewind
// snapshots and GPU history capture. Runs in the dashboard server process.
// With several dashboard processes on one database, a Postgres advisory lock
// picks one to collect; the others take over if it goes away.

const LEADER_LOCK_KEY = 815_204_002;

function seconds(name: string, fallback: number): number {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

const globalForCollectors = globalThis as unknown as { slurmdashCollectors?: boolean };

export function startCollectors() {
  if (globalForCollectors.slurmdashCollectors) return;
  globalForCollectors.slurmdashCollectors = true;

  const nodeIntervalS = seconds("NODE_HISTORY_INTERVAL_SECONDS", 60);
  const nodeRetentionDays = seconds("NODE_HISTORY_RETENTION_DAYS", 30);
  // Capacity is small (one row per cluster per hour) and utilization is
  // reported over years, so it's kept longer, and never shorter than node history
  const capacityDays = seconds("CAPACITY_RETENTION_DAYS", 400);
  const capacityRetentionDays = capacityDays === 0 || nodeRetentionDays === 0 ? 0 : Math.max(capacityDays, nodeRetentionDays);
  const snapshotIntervalM = seconds("SNAPSHOT_INTERVAL_MINUTES", 60);
  const retentionDays = seconds("SNAPSHOT_RETENTION_DAYS", 30);
  const gpuIntervalS = seconds("GPU_CAPTURE_INTERVAL_SECONDS", 60);

  // One nodes fetch feeds both node history and snapshots when they line up
  let lastNodes: { at: number; payload: NodesPayload } | undefined;
  async function nodes(): Promise<NodesPayload> {
    if (lastNodes && Date.now() - lastNodes.at < 5_000) return lastNodes.payload;
    const result = await fetchNodesPayload();
    if ("error" in result) throw new Error(`Slurm nodes: ${result.error}`);
    rememberSlurmClusterName(result.data);
    lastNodes = { at: Date.now(), payload: result.data };
    return result.data;
  }
  const clusterOf = (payload: NodesPayload) => payload?.meta?.slurm?.cluster || readEnv("CLUSTER_NAME") || "cluster";

  // The event log needs no database and runs in every dashboard process
  const eventLog = eventLogConfig();
  if (eventLog) startEventLog(eventLog, nodes, clusterOf);

  const pool = getDb();
  if (!pool) {
    console.log("[collectors] no database configured; node history, Rewind snapshots and GPU history are off");
    return;
  }

  const jobs: Job[] = [];
  if (nodeIntervalS > 0) {
    let lastStateAt: number | undefined;
    let lastPruneAt = 0;
    jobs.push({
      name: "node history",
      intervalMs: nodeIntervalS * 1000,
      run: async () => {
        if (!(await getFeatures()).nodeHistory.enabled) {
          lastStateAt = undefined;
          return;
        }
        const payload = await nodes();
        const cluster = clusterOf(payload);
        const plan = await recordNodeEvents(pool, cluster, payload.nodes);
        if (plan.open.length || plan.close.length) {
          console.log(`[collectors] node history: ${plan.open.length} opened, ${plan.close.length} closed`);
        }

        // Credit the time since the last check, capped so a stall shows as no data
        const now = Date.now();
        const elapsedS = lastStateAt === undefined ? nodeIntervalS : Math.min((now - lastStateAt) / 1000, nodeIntervalS * 2);
        lastStateAt = now;
        await recordNodeStates(pool, cluster, payload.nodes, elapsedS);
        await recordClusterCapacity(pool, cluster, payload.nodes, elapsedS);

        if (now - lastPruneAt > 3_600_000) {
          lastPruneAt = now;
          if (nodeRetentionDays > 0) {
            const pruned = await pruneNodeHistory(pool, cluster, nodeRetentionDays);
            if (pruned) console.log(`[collectors] node history: pruned ${pruned} rows older than ${nodeRetentionDays} days`);
          }
          if (capacityRetentionDays > 0) {
            const pruned = await pruneClusterCapacity(pool, cluster, capacityRetentionDays);
            if (pruned) console.log(`[collectors] cluster capacity: pruned ${pruned} hours older than ${capacityRetentionDays} days`);
          }
        }
      },
    });
  }
  if (snapshotIntervalM > 0) {
    jobs.push({
      // Checks every minute and saves once the latest snapshot is an interval old,
      // so restarts don't reset the schedule
      name: "snapshots",
      intervalMs: 60_000,
      run: async () => {
        const [features, db] = await Promise.all([getFeatures(), getDatabaseStatus()]);
        if (!features.rewind.enabled || !db.tables.nodeSnapshots) return;
        const payload = await nodes();
        const cluster = clusterOf(payload);
        const latest = await latestSnapshotTime(pool, cluster);
        if (latest && Date.now() - latest.getTime() < snapshotIntervalM * 60_000 - 30_000) return;
        await saveSnapshot(pool, cluster, payload);
        const pruned = retentionDays > 0 ? await pruneSnapshots(pool, cluster, retentionDays) : 0;
        console.log(`[collectors] saved snapshot${pruned ? `, pruned ${pruned} older than ${retentionDays} days` : ""}`);
      },
    });
  }
  if (gpuIntervalS > 0) {
    jobs.push({
      name: "GPU history",
      intervalMs: gpuIntervalS * 1000,
      run: async () => {
        if (!(await getFeatures()).gpuHistory.enabled) return;
        const res = await handleCapture();
        const body = await res.json();
        // 429 means a cron call to POST /api/gpu captured within the last minute
        if (body.status !== 200 && body.status !== 429) {
          console.warn(`[collectors] GPU capture: ${body.message ?? body.status}`);
        }
      },
    });
  }

  void lead(jobs);
}

// Checks node states at least every 30 seconds so changes go out promptly;
// EventLog writes metrics once per its interval
function startEventLog(
  config: EventLogConfig,
  nodes: () => Promise<NodesPayload>,
  clusterOf: (payload: NodesPayload) => string
) {
  const log = new EventLog(config);
  const every = Math.min(config.intervalS, 30) * 1000;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const payload = await nodes();
      await log.record(clusterOf(payload), payload.nodes);
    } catch (err) {
      console.error("[collectors] event log:", (err as Error).message);
    } finally {
      running = false;
    }
  };
  console.log(
    `[collectors] event log to ${config.target}: node state changes${config.metrics ? `, metrics every ${config.intervalS}s` : ""}`
  );
  void tick();
  setInterval(tick, every);
}

// Hold the leader lock on a dedicated connection; retry every minute until we
// get it, and start over if that connection drops
async function lead(jobs: Job[]) {
  const pool = getDb();
  if (!pool) return;

  const schema = await ensureSchema();
  if (schema.state === "failed") {
    console.warn(`[collectors] dashboard tables unavailable (${schema.error}); collectors needing them stay off`);
  }

  for (;;) {
    let client;
    try {
      client = await pool.connect();
      const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LEADER_LOCK_KEY]);
      if (rows[0]?.locked) {
        console.log(
          `[collectors] this process collects; scheduled: ${jobs.map((j) => j.name).join(", ") || "nothing"} (each runs while its feature is on)`
        );
        await runWhileConnected(client, jobs);
        console.warn("[collectors] lost the database connection holding the leader lock");
      }
    } catch (err) {
      console.error("[collectors] leader election failed:", (err as Error).message);
    } finally {
      client?.release(true);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

function runWhileConnected(client: { on: (e: string, f: () => void) => void }, jobs: Job[]): Promise<void> {
  return new Promise((resolve) => {
    const timers: NodeJS.Timeout[] = [];
    const stop = () => {
      timers.forEach(clearInterval);
      resolve();
    };
    client.on("error", stop);
    client.on("end", stop);

    for (const job of jobs) {
      let running = false;
      const tick = async () => {
        if (running) return;
        running = true;
        try {
          await job.run();
        } catch (err) {
          console.error(`[collectors] ${job.name}:`, (err as Error).message);
        } finally {
          running = false;
        }
      };
      void tick();
      timers.push(setInterval(tick, job.intervalMs));
    }
  });
}
