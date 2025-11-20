import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error, status } = await fetchSlurmData(`/jobs?node=${params.id[0]}&state=running`, {
    type: 'slurmdb',
    revalidate: 0
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
