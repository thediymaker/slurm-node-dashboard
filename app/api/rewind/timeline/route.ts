export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";
import { getDatabaseStatus, getFeatures } from "@/lib/features";
import { getSlurmClusterName } from "@/lib/slurm-cluster";
import { listSnapshotHours, parseSnapshotFilename } from "@/lib/snapshots";
import { getClusterStateHours } from "@/lib/node-history";

// Snapshot files written by the pre-3.0 cron script. Keep this a literal
// path.join here: an imported path makes Next.js trace the whole project.
const HISTORICAL_DATA_DIR = path.join(process.cwd(), "data");
const HOUR = 60 * 60 * 1000;

// Every hour in the window ending at `end`: whether Rewind has a snapshot for
// it, and with node history, how long nodes spent in each state
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(31, Math.max(1, Number(searchParams.get("days")) || 7));
  const endParam = searchParams.get("end");
  const end = new Date(endParam && !isNaN(Date.parse(endParam)) ? endParam : Date.now());
  end.setUTCMinutes(59, 59, 999);
  const start = new Date(end.getTime() + 1 - days * 24 * HOUR);

  const features = await getFeatures();
  if (!features.rewind.enabled) {
    return NextResponse.json({ message: "Rewind is off" }, { status: 404 });
  }

  const snapshotHours = new Set<number>();
  const states = new Map<number, Record<string, number>>();
  const pool = getDb();

  try {
    if (pool) {
      const cluster = await getSlurmClusterName();
      const tables = (await getDatabaseStatus()).tables;
      const [snaps, hours] = await Promise.all([
        tables.nodeSnapshots ? listSnapshotHours(pool, cluster, start, end) : [],
        features.nodeHistory.enabled ? getClusterStateHours(pool, cluster, start, end) : [],
      ]);
      for (const h of snaps) snapshotHours.add(h.getTime());
      for (const h of hours) states.set(Date.parse(h.hour), h.seconds as Record<string, number>);
    }

    const files = await fs.readdir(HISTORICAL_DATA_DIR).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith(".json.gz")) continue;
      const taken = parseSnapshotFilename(file);
      if (taken && taken >= start && taken <= end) snapshotHours.add(Math.floor(taken.getTime() / HOUR) * HOUR);
    }
  } catch (err) {
    console.error("Error reading the Rewind timeline:", err);
    return NextResponse.json({ message: "Error reading the Rewind timeline" }, { status: 500 });
  }

  const hours = [];
  for (let t = start.getTime(); t <= end.getTime(); t += HOUR) {
    hours.push({ hour: new Date(t).toISOString(), snapshot: snapshotHours.has(t), seconds: states.get(t) ?? null });
  }
  return NextResponse.json({ start: start.toISOString(), end: end.toISOString(), hours });
}
