export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFeatures } from "@/lib/features";
import { getNodePreemption } from "@/lib/metrics/preemption";
import { getSlurmClusterName } from "@/lib/slurm-cluster";

// Jobs that ran on one node lately and how many were preempted, for the node sheet
const DAYS = 30;

export async function GET(req: NextRequest) {
  const node = req.nextUrl.searchParams.get("node");
  if (!node) return NextResponse.json({ message: "node is required" }, { status: 400 });
  const pool = getDb();
  if (!pool || !(await getFeatures()).jobMetrics.enabled) {
    return NextResponse.json({ enabled: false });
  }
  try {
    const preemption = await getNodePreemption(pool, await getSlurmClusterName(), node, DAYS);
    return NextResponse.json({ enabled: true, days: DAYS, ...preemption });
  } catch (err) {
    console.error("Error reading node preemption:", err);
    return NextResponse.json({ message: "Error reading node preemption" }, { status: 500 });
  }
}
