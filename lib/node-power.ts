import { prom } from "@/lib/prometheus";
import { extractNumericValue } from "@/lib/gpu-metrics";

type Labels = Record<string, string | undefined>;

// Short host name from whichever label the exporter uses
export function hostOf(labels: Labels): string | undefined {
  const raw = labels.nodename || labels.Hostname || labels.hostname || labels.node || labels.instance;
  return raw?.replace(/:\d+$/, "").split(".")[0];
}

// Watts per host from the IPMI exporter; empty without Prometheus or IPMI
export async function fetchIpmiPower(): Promise<Map<string, number>> {
  const power = new Map<string, number>();
  if (!prom) return power;
  const res = await prom.instantQuery('ipmi_power_watts{name="Pwr Consumption"} or ipmi_dcmi_power_consumption_watts');
  for (const item of (res?.result ?? []) as { metric?: { labels?: Labels }; value?: unknown }[]) {
    const host = hostOf(item.metric?.labels ?? {});
    const value = extractNumericValue(item.value as never);
    if (host && Number.isFinite(value)) power.set(host, Math.round(value));
  }
  return power;
}
