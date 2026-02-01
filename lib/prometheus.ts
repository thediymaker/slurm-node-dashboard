import { PrometheusDriver } from "prometheus-query";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

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
 * Cache for node instance lookups to avoid repeated Prometheus queries
 */
const instanceCache = new Map<string, { instance: string; timestamp: number }>();
const INSTANCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the Prometheus instance label for a given node name.
 * Uses node_uname_info metric to resolve nodename -> instance.
 * Results are cached for 5 minutes.
 */
export async function getInstanceForNode(nodeName: string): Promise<string | null> {
  if (!prom || !nodeName) return null;

  // Check cache first
  const cached = instanceCache.get(nodeName);
  if (cached && Date.now() - cached.timestamp < INSTANCE_CACHE_TTL) {
    return cached.instance;
  }

  try {
    const result = await prom.instantQuery(`node_uname_info{nodename="${nodeName}"}`);
    const instance = result?.result?.[0]?.metric?.labels?.instance;

    if (instance) {
      instanceCache.set(nodeName, { instance, timestamp: Date.now() });
      return instance;
    }
  } catch (error) {
    console.error(`Error resolving instance for node ${nodeName}:`, error);
  }

  return null;
}
