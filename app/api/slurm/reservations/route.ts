export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET() {
  const isEnabled =
    String(process.env.MAINT_NOTIFICATIONS_ENABLED ?? "true").toLowerCase() === "true";

  if (!isEnabled) {
    return NextResponse.json({ meta: { enabled: false }, reservations: [] });
  }

  const { data, error, status } = await fetchSlurmData('/reservations');

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
