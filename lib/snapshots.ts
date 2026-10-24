import zlib from "zlib";
import { promisify } from "util";
import type { DbPool } from "@/lib/db";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Rewind snapshots: the /api/slurm/nodes payload, gzipped, one row per capture

export async function saveSnapshot(pool: DbPool, cluster: string, payload: unknown, takenAt = new Date()) {
  const data = await gzip(Buffer.from(JSON.stringify(payload)));
  await pool.query(
    "INSERT INTO node_snapshots (cluster, taken_at, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [cluster, takenAt, data]
  );
}

export async function latestSnapshotTime(pool: DbPool, cluster: string): Promise<Date | null> {
  const { rows } = await pool.query("SELECT max(taken_at) AS latest FROM node_snapshots WHERE cluster = $1", [cluster]);
  return rows[0]?.latest ? new Date(rows[0].latest) : null;
}

export async function pruneSnapshots(pool: DbPool, cluster: string, retentionDays: number): Promise<number> {
  const result = await pool.query(
    "DELETE FROM node_snapshots WHERE cluster = $1 AND taken_at < now() - make_interval(days => $2)",
    [cluster, retentionDays]
  );
  return result.rowCount ?? 0;
}

// The snapshot in [from, to] closest to `from`, the same rule Rewind uses for
// snapshot files
export async function findSnapshot(pool: DbPool, cluster: string, from: Date, to: Date): Promise<unknown | null> {
  const { rows } = await pool.query(
    `SELECT data FROM node_snapshots
     WHERE cluster = $1 AND taken_at BETWEEN $2 AND $3
     ORDER BY taken_at ASC LIMIT 1`,
    [cluster, from, to]
  );
  if (rows.length === 0) return null;
  return JSON.parse((await gunzip(rows[0].data)).toString("utf-8"));
}
