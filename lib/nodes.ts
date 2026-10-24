import { fetchSlurmData } from "@/lib/slurm-api";
import { getExcludedNodeSet, loadDashboardConfig } from "@/lib/node-config";

type SlurmNumber = number | { set?: boolean; infinite?: boolean; number?: number };

// The node fields the dashboard's background jobs read; payloads keep
// everything slurmrestd returns
export interface SlurmNode {
  name?: string;
  hostname?: string;
  state?: string[] | string;
  state_flags?: string[];
  reason?: string;
  reason_set_by_user?: string;
  reason_changed_at?: SlurmNumber;
  [key: string]: unknown;
}

export interface NodesPayload {
  nodes: SlurmNode[];
  meta?: { slurm?: { cluster?: string } };
  [key: string]: unknown;
}

// The /nodes response with excluded nodes removed: what /api/slurm/nodes
// returns and what Rewind snapshots store
export async function fetchNodesPayload(): Promise<{ data: NodesPayload } | { error: string; status: number }> {
  const [slurmResult, config] = await Promise.all([fetchSlurmData("/nodes"), loadDashboardConfig()]);

  if (slurmResult.error) {
    return { error: slurmResult.error, status: slurmResult.status ?? 500 };
  }

  const allNodes: SlurmNode[] = slurmResult.data?.nodes || [];
  const excludedNodes = getExcludedNodeSet(config);
  const nodes =
    excludedNodes.size > 0 ? allNodes.filter((node) => !excludedNodes.has(node.hostname ?? "")) : allNodes;

  return { data: { ...slurmResult.data, nodes } };
}
