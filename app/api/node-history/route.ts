export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFeatures } from "@/lib/features";
import { getNodeHistory } from "@/lib/node-history";
import { getSlurmClusterName } from "@/lib/slurm-cluster";

// GET /api/node-history?node=<name>&days=<1-365, default 30>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const node = url.searchParams.get("node");
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);

  if (!node || !/^[A-Za-z0-9._-]+$/.test(node)) {
    return NextResponse.json({ message: "node is required" }, { status: 400 });
  }

  const feature = (await getFeatures()).nodeHistory;
  const pool = getDb();
  if (!feature.enabled || !pool) {
    return NextResponse.json({ enabled: false, events: [] });
  }

  try {
    const events = await getNodeHistory(pool, await getSlurmClusterName(), node, days);
    return NextResponse.json({ enabled: true, days, now: new Date().toISOString(), events });
  } catch (err) {
    console.error("Error reading node history:", err);
    return NextResponse.json({ message: "Error reading node history" }, { status: 500 });
  }
}
