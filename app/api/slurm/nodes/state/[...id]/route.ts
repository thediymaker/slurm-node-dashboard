export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string[] }> }
) {
  const { id } = await params;
  const { data, error, status } = await fetchSlurmData(`/node/${id[0]}`, {
    revalidate: 0
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string[] }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const requestBody = {
      state: `${body.state}`,
      reason: `${body.reason}`,
    };

    const { data, error, status } = await fetchSlurmData(`/node/${id[0]}`, {
      method: 'POST',
      body: requestBody,
      revalidate: 0
    });

    if (error) {
      throw new Error(`HTTP error! status: ${status}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error updating node state:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update node state" },
      { status: 500 }
    );
  }
}
