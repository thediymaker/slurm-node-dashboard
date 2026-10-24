export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import {
  handleCapture,
  handleJobQuery,
  handleOverview,
  queryJobFromDatabase,
  validateCaptureAuth,
  type CaptureResult,
  type GPUJobSourceMode,
} from "@/lib/gpu-service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");
  const requestedSource = url.searchParams.get("source") || url.searchParams.get("prefer");
  const sourceMode: GPUJobSourceMode = requestedSource === "database" ? "database" : "auto";
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  try {
    if (jobId) {
      return await handleJobQuery(jobId, sourceMode);
    }
    return await handleOverview(from, to);
  } catch (error) {
    console.error("Error fetching GPU metrics:", error);

    // If querying a specific job, try database fallback
    if (jobId) {
      const dbData = await queryJobFromDatabase(jobId).catch(() => null);
      if (dbData) {
        return NextResponse.json({ status: 200, data: dbData });
      }
    }

    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU metrics",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Kept for pre-3.0 cron jobs; the dashboard now captures on its own
export async function POST(req: Request): Promise<NextResponse<CaptureResult>> {
  const authError = validateCaptureAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const dryRun =
    url.searchParams.get("dry_run") === "true" ||
    url.searchParams.get("dryRun") === "true" ||
    url.searchParams.get("debug") === "true";

  return handleCapture({ dryRun });
}
