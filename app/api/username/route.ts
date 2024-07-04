import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const username = req.headers.get("x-cas-user") as string;

  return NextResponse.json({ username });
}

