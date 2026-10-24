export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFeatures } from "@/lib/features";
import { getRecentNodeChanges } from "@/lib/node-history";
import { getSlurmClusterName } from "@/lib/slurm-cluster";

// Nodes whose availability changed in the last 10 minutes, for the ring on node cards
const MINUTES = 10;

export async function GET() {
  const pool = getDb();
  if (!pool || !(await getFeatures()).nodeHistory.enabled) {
    return NextResponse.json({ enabled: false, changes: [] });
  }
  try {
    const changes = await getRecentNodeChanges(pool, await getSlurmClusterName(), MINUTES);
    return NextResponse.json({ enabled: true, minutes: MINUTES, changes });
  } catch (err) {
    console.error("Error reading recent node changes:", err);
    return NextResponse.json({ message: "Error reading recent node changes" }, { status: 500 });
  }
}
