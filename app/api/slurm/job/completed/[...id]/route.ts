export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string[] }> }
) {
  const { id } = await params;
  const { data, error, status } = await fetchSlurmData(`/job/${id[0]}`, {
    type: 'slurmdb',
    revalidate: 0
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
