import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error, status } = await fetchSlurmData(`/jobs?users=${params.id[0]}&state=running`, {
    type: 'slurmdb'
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}