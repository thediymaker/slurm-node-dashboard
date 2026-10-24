export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchNodesPayload } from "@/lib/nodes";

export async function GET() {
  const result = await fetchNodesPayload();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
