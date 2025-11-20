export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  request: Request,
  { params }: { params: { name: string } }
) {
  const name = params.name;
  const { data, error, status } = await fetchSlurmData(`/qos/${name}`, 'slurmdb');

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
