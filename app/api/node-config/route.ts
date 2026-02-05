import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Cache the config to avoid reading file on every request
let configCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute cache

// Allow the node configuration path to be overridden via environment variable.
// Defaults to "infra/node.cfg" relative to the app root.
const NODEVIEW_CONFIG_PATH = process.env.NODEVIEW_CONFIG_PATH || "infra/node.cfg";

export async function GET() {
  try {
    const now = Date.now();
    
    // Return cached config if still valid
    if (configCache && now - configCache.timestamp < CACHE_TTL) {
      return NextResponse.json(configCache.data);
    }

    const configPath = path.isAbsolute(NODEVIEW_CONFIG_PATH)
      ? NODEVIEW_CONFIG_PATH
      : path.join(process.cwd(), NODEVIEW_CONFIG_PATH);
    const rawContent = await fs.readFile(configPath, "utf-8");

    // Allow simple `//` comments in node.cfg by stripping commented lines
    const configContent = rawContent
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

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
