import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { env } from "process";

const gunzip = promisify(zlib.gunzip);

function parseFilename(filename: string): Date | null {
  try {
    const [datePart, timePart] = filename.replace(".json.gz", "").split("T");
    const [year, month, day] = datePart.split("-");
    const [hour, minute, secondAndMillis] = timePart.split("-");
    const [second, millis] = secondAndMillis.split(".");

    const date = new Date(
      Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(millis)
      )
    );

    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const time = searchParams.get("time");

    if (!date || !time) {
      return NextResponse.json(
        { message: "Date and time are required" },
        { status: 400 }
      );
    }

    const dataDir =
      env.HISTORICAL_DATA_DIR || path.join(process.cwd(), "data");
    const files = await fs.readdir(dataDir);
    const [hour] = time.split(":");
    const targetStartTime = new Date(`${date}T${hour}:00:00.000Z`);
    const targetEndTime = new Date(`${date}T${hour}:59:59.999Z`);

    let closestFile = null;
    let smallestDifference = Infinity;

    for (const file of files) {
      if (file.endsWith(".json.gz")) {
        const fileDate = parseFilename(file);
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
      } catch (jsonError: any) {
        return NextResponse.json(
          {
            message: "Error parsing JSON content",
            error: jsonError.toString(),
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
  } catch (error: any) {
    return NextResponse.json(
      { message: "Internal Server Error", error: error.toString() },
      { status: 500 }
    );
  }
}
