import { NextResponse } from "next/server";
import { env } from "process";

export async function GET() {
  if (!process.env.SLURM_SERVER) {
    return NextResponse.json(
      { error: "Server configuration not available during build" },
      { status: 503 }
    );
  }
  
  const res = await fetch(
    `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/jobs`,
    {
      headers: {
        "X-SLURM-USER-NAME": `${env.SLURM_API_ACCOUNT}`,
        "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
      },
      next: {
        revalidate: 30,
      },
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}