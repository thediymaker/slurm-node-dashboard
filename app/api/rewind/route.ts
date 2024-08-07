import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function parseFilename(filename: string): Date | null {
  try {
    const [datePart, timePart] = filename.replace(".json", "").split("T");
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

    if (!isNaN(date.getTime())) {
      return date;
    }
    console.log("Failed to parse date from filename");
    return null;
  } catch (error) {
    console.error("Error parsing filename:", error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const time = searchParams.get("time");

    console.log("Received request with date:", date, "and time:", time);

    if (!date || !time) {
      return NextResponse.json(
        { message: "Date and time are required" },
        { status: 400 }
      );
    }

    const dataDir =
      process.env.HISTORICAL_DATA_DIR || path.join(process.cwd(), "data");
    console.log("Looking for files in:", dataDir);

    const files = await fs.readdir(dataDir);
    const [hour] = time.split(":");
    const targetStartTime = new Date(`${date}T${hour}:00:00.000Z`);
    const targetEndTime = new Date(`${date}T${hour}:59:59.999Z`);

    console.log(
      "Target time range:",
      targetStartTime.toISOString(),
      "to",
      targetEndTime.toISOString()
    );

    let closestFile = null;
    let smallestDifference = Infinity;

    for (const file of files) {
      if (file.endsWith(".json")) {
        const fileDate = parseFilename(file);
        if (fileDate) {
          console.log(
            "Checking file:",
            file,
            "with time:",
            fileDate.toISOString()
          );
          if (fileDate >= targetStartTime && fileDate <= targetEndTime) {
            const difference = Math.abs(
              fileDate.getTime() - targetStartTime.getTime()
            );
            if (difference < smallestDifference) {
              smallestDifference = difference;
              closestFile = file;
            }
          }
        } else {
          console.log("Skipping file with invalid date format:", file);
        }
      }
    }

    console.log("Closest file found:", closestFile);

    if (closestFile) {
      const filePath = path.join(dataDir, closestFile);
      const fileContent = await fs.readFile(filePath, "utf-8");
      try {
        const jsonContent = JSON.parse(fileContent);
        return NextResponse.json(jsonContent, { status: 200 });
      } catch (jsonError: any) {
        console.error("Error parsing JSON content:", jsonError);
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
    console.error("Error fetching historical data:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.toString() },
      { status: 500 }
    );
  }
}
