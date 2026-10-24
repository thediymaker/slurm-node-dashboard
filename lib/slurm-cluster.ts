import { readEnv } from "@/lib/config";
import { fetchSlurmData } from "@/lib/slurm-api";

// Slurm's own cluster name (ClusterName in slurm.conf), which keys the history
// tables so several clusters can share one database. CLUSTER_NAME is only the
// display name and is the fallback.
let cached: string | undefined;

export function rememberSlurmClusterName(payload: { meta?: { slurm?: { cluster?: string } } } | undefined) {
  const name = payload?.meta?.slurm?.cluster;
  if (typeof name === "string" && name) cached = name;
}

export async function getSlurmClusterName(): Promise<string> {
  if (cached) return cached;
  const result = await fetchSlurmData("/diag");
  if (!result.error) rememberSlurmClusterName(result.data);
  return cached ?? readEnv("CLUSTER_NAME") ?? "cluster";
}
