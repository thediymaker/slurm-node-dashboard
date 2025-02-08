import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const configPath = path.join(process.cwd(), "node.cfg");
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Node configuration is not available or invalid. Showing all nodes without grouping. Please check the "node.cfg" file.`,
      },
      { status: 404 }
    );
  }
}
