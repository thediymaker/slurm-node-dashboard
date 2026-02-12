import { NextResponse } from "next/server";
import { loadDashboardConfig } from "@/lib/node-config";

export async function GET() {
  try {
    const config = await loadDashboardConfig();

    // Return just the rackLayout for backward compatibility with grouped-nodes.tsx
    // The frontend currently expects the flat rack layout object
    return NextResponse.json(config.rackLayout);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Node configuration is not available or invalid. Showing all nodes without grouping. Please check the "node.cfg" file.`,
      },
      { status: 404 }
    );
  }
}
