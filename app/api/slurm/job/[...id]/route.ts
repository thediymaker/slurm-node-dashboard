import { NextResponse } from "next/server";
import { env } from "process";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const res = await fetch(
    `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/job/${params.id[0]}`,
    {
      headers: {
        "X-SLURM-USER-NAME": `${env.SLURM_API_ACCOUNT}`,
        "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
      },
      next: {
        revalidate: 0,
      },
    }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
