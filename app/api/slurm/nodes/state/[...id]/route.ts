import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error, status } = await fetchSlurmData(`/node/${params.id[0]}`, {
    revalidate: 0
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const requestBody = {
      state: `${body.state}`,
      reason: `${body.reason}`,
    };

    const { data, error, status } = await fetchSlurmData(`/node/${params.id[0]}`, {
      method: 'POST',
      body: requestBody,
      revalidate: 0
    });

    if (error) {
      throw new Error(`HTTP error! status: ${status}`);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ Error: error });
  }
}
