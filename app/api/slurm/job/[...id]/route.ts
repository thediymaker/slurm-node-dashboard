import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error, status } = await fetchSlurmData(`/job/${params.id[0]}`, {
    revalidate: 0
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}
