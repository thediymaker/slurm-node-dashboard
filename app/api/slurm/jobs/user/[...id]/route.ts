import { NextResponse } from "next/server";
import { env } from "process";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const urlz = `http://${env.SLURM_SERVER}:6820/slurmdb/${env.SLURM_API_VERSION}/jobs?users=${params.id[0]}&state=running`
  const res = await fetch(
    `http://${env.SLURM_SERVER}:6820/slurmdb/${env.SLURM_API_VERSION}/jobs?users=${params.id[0]}&state=running`,
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