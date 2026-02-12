export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { fetchSlurmData } from "@/lib/slurm-api";
import { loadDashboardConfig, getExcludedNodeSet } from "@/lib/node-config";

export async function GET() {
  const [slurmResult, config] = await Promise.all([
    fetchSlurmData('/nodes'),
    loadDashboardConfig()
  ]);

  if (slurmResult.error) {
    return NextResponse.json({ error: slurmResult.error }, { status: slurmResult.status });
  }

  const allNodes = slurmResult.data?.nodes || [];

  // Filter out excluded nodes
  const excludedNodes = getExcludedNodeSet(config);
  const filteredNodes = excludedNodes.size > 0
    ? allNodes.filter((node: any) => !excludedNodes.has(node.hostname))
    : allNodes;

  return NextResponse.json({ ...slurmResult.data, nodes: filteredNodes });
}
