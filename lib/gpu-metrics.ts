import { prom } from "@/lib/prometheus";

/**
 * Shared GPU metrics helpers for Prometheus value extraction and recording rule checks.
 * Used by /api/gpu, /api/gpu/node, and /api/gpu/report routes.
 */

/**
 * Extract a numeric value from a Prometheus result item's value field.
 * Handles all formats returned by the prometheus-query library:
 * - Array: [timestamp, "value"] (raw Prometheus API format)
 * - Object: { time: Date, value: number } (prometheus-query SampleValue)
 * - Primitive: number or string
 */
export const extractNumericValue = (value: any): number => {
  if (Array.isArray(value) && value.length > 1) {
    return parseFloat(value[1]);
  }
  if (typeof value === "object" && value !== null && value.value !== undefined) {
    return parseFloat(value.value);
  }
  return parseFloat(value);
};

/**
 * Extract a single scalar value from a Prometheus instant query result.
 * Returns null if no result or parsing fails.
 */
export const extractValue = (result: any): number | null => {
  try {
    if (!result?.result || !result.result[0]) return null;
    const item = result.result[0];
    if (item.value) {
      const parsed = extractNumericValue(item.value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Extract labeled series from a Prometheus instant query result.
 * Returns an array of objects with jobId, labels, value, hostname, gpuModel, and timestamp.
 */
export const extractSeries = (result: any): PrometheusSeries[] => {
  try {
    if (!result?.result || !Array.isArray(result.result)) return [];

    return result.result.map((item: any) => {
      const metric = item.metric || {};
      const labels = metric.labels || {};
      const jobId = labels.hpc_job || metric.hpc_job || "unknown";

      let value = 0;
      let timestamp = Date.now() / 1000;

      if (item.value) {
        if (Array.isArray(item.value) && item.value.length > 1) {
          value = parseFloat(item.value[1]);
          if (typeof item.value[0] === "number") {
            timestamp = item.value[0];
          }
        } else {
          value = extractNumericValue(item.value);
        }
      }

      return {
        jobId,
        labels,
        value: isNaN(value) ? 0 : value,
        hostname: labels.Hostname || metric.Hostname || "unknown",
        gpuModel: labels.modelName || metric.modelName || "unknown",
        timestamp,
      };
    });
  } catch {
    return [];
  }
};

export interface PrometheusSeries {
  jobId: string;
  labels: Record<string, string>;
  value: number;
  hostname: string;
  gpuModel: string;
  timestamp: number;
}

/**
 * Check if Prometheus recording rules for GPU metrics are available.
 * Optionally test with a specific job ID.
 */
export const checkRecordingRulesAvailable = async (jobId?: string): Promise<boolean> => {
  if (!prom) return false;
  try {
    const query = jobId
      ? `job:gpu_utilization:current_avg{hpc_job="${jobId}"}`
      : "job:gpu_utilization:current_avg";
    const result = await prom.instantQuery(query);
    return result && Array.isArray(result.result) && result.result.length > 0;
  } catch {
    return false;
  }
};

/**
 * Count the number of results in a Prometheus query response.
 */
export const extractCount = (result: any): number => {
  try {
    if (!result?.result || !Array.isArray(result.result)) return 0;
    return result.result.length;
  } catch {
    return 0;
  }
};
