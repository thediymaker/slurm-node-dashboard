import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Cache the config to avoid reading file on every request
let configCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute cache

export async function GET() {
  try {
    const now = Date.now();
    
    // Return cached config if still valid
    if (configCache && now - configCache.timestamp < CACHE_TTL) {
      return NextResponse.json(configCache.data);
    }

    const configPath = path.join(process.cwd(), "node.cfg");
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);

    // Update cache
    configCache = { data: config, timestamp: now };

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
