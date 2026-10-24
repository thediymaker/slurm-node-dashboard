import { PrometheusDriver } from "prometheus-query";
import { readEnv } from "@/lib/config";

// Prometheus is on whenever PROMETHEUS_URL is set. NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN
// never controlled this, and the shipped .env template sets it to "false", so
// it's ignored rather than allowed to switch off working charts.
const PROMETHEUS_URL = readEnv("PROMETHEUS_URL");

/**
 * Shared Prometheus driver instance.
 * Returns null if PROMETHEUS_URL is not configured.
 */
export const prom: PrometheusDriver | null = PROMETHEUS_URL
  ? new PrometheusDriver({
      endpoint: PROMETHEUS_URL,
      baseURL: "/api/v1",
    })
  : null;

/**
 * Check if Prometheus is configured and available
 */
export function isPrometheusConfigured(): boolean {
  return prom !== null;
}

/**
 * Get the Prometheus URL (useful for debugging)
 */
export function getPrometheusUrl(): string | undefined {
  return PROMETHEUS_URL;
}

/**
 * Escape a value for use inside a double-quoted PromQL string
 */
export const escapePromString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * Escape regex metacharacters so a value matches literally in a =~ matcher
 */
export const escapePromRegex = (value: string) =>
  value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

/**
 * Regex (already escaped for a PromQL string) matching a Slurm node name with or
 * without a domain suffix, since exporters often report the FQDN ("node21.cluster"
 * for Slurm's "node21"). PromQL regexes are fully anchored.
 */
export const nodeNameRegex = (nodeName: string) =>
  escapePromString(`${escapePromRegex(nodeName)}(\\..+)?`);

/**
 * Cache for node instance lookups to avoid repeated Prometheus queries
 */
const instanceCache = new Map<string, { instance: string; timestamp: number }>();
const INSTANCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the Prometheus instance label for a given node name.
 * Uses node_uname_info to resolve nodename -> instance, falling back to the
 * instance label itself for setups that scrape targets by hostname.
 * Looks back `lookbackDays` so nodes that are down still resolve for history.
 * Results are cached for 5 minutes.
 */
export async function getInstanceForNode(
  nodeName: string,
  lookbackDays = 1
): Promise<string | null> {
  if (!prom || !nodeName) return null;

  // Check cache first
  const cached = instanceCache.get(nodeName);
  if (cached && Date.now() - cached.timestamp < INSTANCE_CACHE_TTL) {
    return cached.instance;
  }

  const name = nodeNameRegex(nodeName);
  const days = Number.isFinite(lookbackDays) ? Math.max(1, Math.ceil(lookbackDays)) : 1;
  const selectors = [
    `node_uname_info{nodename=~"${name}"}`,
    `node_uname_info{instance=~"${name}(:[0-9]+)?"}`,
  ];

  for (const selector of selectors) {
    try {
      const result = await prom.instantQuery(`last_over_time(${selector}[${days}d])`);
      const series = result?.result ?? [];
      // Prefer an exact nodename match if both "node21" and "node21.domain" exist
      const match =
        series.find((s) => s.metric?.labels?.nodename === nodeName) ?? series[0];
      const instance = match?.metric?.labels?.instance;

      if (instance) {
        instanceCache.set(nodeName, { instance, timestamp: Date.now() });
        return instance;
      }
    } catch (error) {
      console.error(`Error resolving instance for node ${nodeName}:`, error);
    }
  }

  return null;
}
