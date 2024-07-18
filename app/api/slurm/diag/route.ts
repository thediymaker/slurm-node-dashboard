import { NextResponse } from "next/server";
import { env } from "process";

export async function GET() {
  const res = await fetch(
    `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/diag`,
    {
      headers: {
        "X-SLURM-USER-NAME": "root",
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
