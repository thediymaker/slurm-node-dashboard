export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getFeatures } from "@/lib/features";
import { getUserFairshare } from "@/lib/fairshare";

export async function GET(_req: Request, { params }: { params: Promise<{ user: string }> }) {
  const { user } = await params;
  if (!/^[\w.@-]{1,64}$/.test(user)) return NextResponse.json({ message: "Invalid user" }, { status: 400 });
  if (!(await getFeatures()).fairshare.enabled) {
    return NextResponse.json({ available: false, reason: "Fair share is turned off" });
  }
  return NextResponse.json(await getUserFairshare(user));
}
