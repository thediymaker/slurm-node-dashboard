export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { env } from "process";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET() {
  const isEnabled =
    String(env.MAINT_NOTIFICATIONS_ENABLED ?? "true").toLowerCase() === "true";

  if (!isEnabled) {
    return NextResponse.json({ meta: { enabled: false }, reservations: [] });
  }

  const { data, error, status } = await fetchSlurmData('/reservations');

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
