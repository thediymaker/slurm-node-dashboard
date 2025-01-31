import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const configPath = path.join(process.cwd(), "node.cfg");
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    console.log("Node configuration loaded successfully");

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error reading node configuration:", error);
    return NextResponse.json(
      { error: "Failed to load node configuration" },
      { status: 500 }
    );
  }
}
