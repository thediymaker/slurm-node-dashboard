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

// Hours in [from, to] that have a snapshot, oldest first
export async function listSnapshotHours(pool: DbPool, cluster: string, from: Date, to: Date): Promise<Date[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT date_trunc('hour', taken_at) AS hour FROM node_snapshots
     WHERE cluster = $1 AND taken_at BETWEEN $2 AND $3
     ORDER BY hour`,
    [cluster, from, to]
  );
  return rows.map((r: { hour: Date }) => new Date(r.hour));
}

// Snapshot files from the pre-3.0 cron script are named for their UTC time,
// e.g. 2025-01-31T14-00-02.123.json.gz
export function parseSnapshotFilename(filename: string): Date | null {
  try {
    const [datePart, timePart] = filename.replace(".json.gz", "").split("T");
    const [year, month, day] = datePart.split("-");
    const [hour, minute, secondAndMillis] = timePart.split("-");
    const [second, millis] = secondAndMillis.split(".");

    const date = new Date(
      Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(millis)
      )
    );

    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
