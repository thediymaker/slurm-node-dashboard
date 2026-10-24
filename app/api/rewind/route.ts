export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { getDb } from "@/lib/db";
import { getDatabaseStatus, isFeatureEnabled } from "@/lib/features";
import { getSlurmClusterName } from "@/lib/slurm-cluster";
import { findSnapshot, parseSnapshotFilename } from "@/lib/snapshots";

const gunzip = promisify(zlib.gunzip);
// Snapshot files written by the pre-3.0 cron script. Keep this a literal
// path.join here: an imported path makes Next.js trace the whole project.
const HISTORICAL_DATA_DIR = path.join(process.cwd(), "data");

function errorToString(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const at = searchParams.get("at");
    const date = searchParams.get("date");
    const time = searchParams.get("time");

    if (!(at && !isNaN(Date.parse(at))) && !(date && time)) {
      return NextResponse.json(
        { message: "Give a time as at=<ISO timestamp>, or date and time" },
        { status: 400 }
      );
    }

    if (!(await isFeatureEnabled("rewind"))) {
      return NextResponse.json({ message: "Rewind is off" }, { status: 404 });
    }

    // The hour starting at `at`; date and time (read as UTC) are the older form
    let targetStartTime: Date;
    if (at && !isNaN(Date.parse(at))) {
      targetStartTime = new Date(at);
    } else {
      const [hour] = time!.split(":");
      targetStartTime = new Date(`${date}T${hour}:00:00.000Z`);
    }
    const targetEndTime = new Date(targetStartTime.getTime() + 60 * 60 * 1000 - 1);

    // Snapshots the dashboard saved itself come first
    const pool = getDb();
    if (pool && (await getDatabaseStatus()).tables.nodeSnapshots) {
      const snapshot = await findSnapshot(pool, await getSlurmClusterName(), targetStartTime, targetEndTime);
      if (snapshot) return NextResponse.json(snapshot, { status: 200 });
    }

    const dataDir = HISTORICAL_DATA_DIR;
    const files = await fs.readdir(dataDir).catch(() => [] as string[]);

    let closestFile = null;
    let smallestDifference = Infinity;

    for (const file of files) {
      if (file.endsWith(".json.gz")) {
        const fileDate = parseSnapshotFilename(file);
        if (
          fileDate &&
          fileDate >= targetStartTime &&
          fileDate <= targetEndTime
        ) {
          const difference = Math.abs(
            fileDate.getTime() - targetStartTime.getTime()
          );
          if (difference < smallestDifference) {
            smallestDifference = difference;
            closestFile = file;
          }
        }
      }
    }

    if (closestFile) {
      const filePath = path.join(dataDir, closestFile);
      const compressedContent = await fs.readFile(filePath);

      if (compressedContent.length === 0) {
        return NextResponse.json(
          { message: "The file is empty" },
          { status: 404 }
        );
      }

      const decompressedContent = await gunzip(compressedContent);
      const fileContent = decompressedContent.toString("utf-8");

      if (fileContent.trim().length === 0) {
        return NextResponse.json(
          { message: "The file contains no data" },
          { status: 404 }
        );
      }

      try {
        const jsonContent = JSON.parse(fileContent);
        return NextResponse.json(jsonContent, { status: 200 });
      } catch (jsonError: unknown) {
        return NextResponse.json(
          {
            message: "Error parsing JSON content",
            error: errorToString(jsonError),
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { message: "No data found for the specified date and time range" },
        { status: 404 }
      );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { message: "Internal Server Error", error: errorToString(error) },
      { status: 500 }
    );
  }
}
