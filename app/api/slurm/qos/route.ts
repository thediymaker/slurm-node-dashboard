export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET() {
  const { data, error, status } = await fetchSlurmData('/qos', { type: 'slurmdb' });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
