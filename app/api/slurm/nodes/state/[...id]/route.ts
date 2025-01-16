import { NextResponse } from "next/server";
import { env } from "process";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/node/${params.id[0]}`,
    {
      method: "GET",
      headers: {
        "X-SLURM-USER-NAME": `${env.SLURM_API_ACCOUNT}`,
        "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await res.json();
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

    const response = await fetch(
      `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/node/${params.id[0]}`,
      {
        method: "POST",
        headers: {
          "X-SLURM-USER-NAME": `${env.SLURM_API_ACCOUNT}`,
          "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ Error: error });
  }
}
