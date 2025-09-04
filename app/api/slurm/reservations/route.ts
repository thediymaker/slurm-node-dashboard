export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { env } from "process";

export async function GET() {
  const isEnabled =
    String(env.MAINT_NOTIFICATIONS_ENABLED ?? "true").toLowerCase() === "true";

  if (!isEnabled) {
    return NextResponse.json({ meta: { enabled: false }, reservations: [] });
  }

  const res = await fetch(
    `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/reservations`,
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
