export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getFeatures } from "@/lib/features";
import { prom } from "@/lib/prometheus";
import { buildGpuMetricsFilter, extractNumericValue, promSelector } from "@/lib/gpu-metrics";
import { fetchIpmiPower, hostOf } from "@/lib/node-power";

// Per-node extras for the large node cards, all from Prometheus and all
// optional: power and temperature (IPMI or node_exporter), per-GPU
// utilization (DCGM) and the last hour of load (node_exporter). Each query
// fails on its own; a site without IPMI still gets load and GPUs.

export interface NodeExtras {
  power?: number;
  temp?: number;
  gpuUtil?: number[];
  load?: number[];
}

const CACHE_MS = 30_000;
let cached: { at: number; body: { enabled: boolean; nodes: Record<string, NodeExtras> } } | undefined;

type Labels = Record<string, string | undefined>;
interface SeriesItem {
  metric?: { labels?: Labels };
  value?: unknown;
  values?: { time: Date; value: number }[];
}

async function instant(query: string): Promise<SeriesItem[]> {
  const res = await prom!.instantQuery(query);
  return (res?.result ?? []) as SeriesItem[];
}

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) return NextResponse.json(cached.body);

  const features = await getFeatures();
  if (!prom || !features.prometheus.enabled) {
    return NextResponse.json({ enabled: false, nodes: {} });
  }

  const nodes: Record<string, NodeExtras> = {};
  const entry = (host: string) => (nodes[host] ??= {});

  const end = new Date();
  const start = new Date(end.getTime() - 60 * 60 * 1000);

  await Promise.all([
    fetchIpmiPower()
      .then((power) => {
        for (const [host, watts] of power) entry(host).power = watts;
      })
      .catch(() => {}),

    // Prefer the hottest hwmon sensor; IPMI temperatures where node_exporter has none
    instant(
      "max by (nodename) (node_hwmon_temp_celsius * on(instance) group_left(nodename) node_uname_info)" +
        " or max by (hostname, instance, node) (ipmi_temperature_celsius)"
    )
      .then((items) => {
        for (const item of items) {
          const host = hostOf(item.metric?.labels ?? {});
          const value = extractNumericValue(item.value as never);
          if (host && Number.isFinite(value) && entry(host).temp === undefined) entry(host).temp = Math.round(value);
        }
      })
      .catch(() => {}),

    features.gpu.enabled
      ? instant(promSelector("DCGM_FI_DEV_GPU_UTIL", buildGpuMetricsFilter()))
          .then((items) => {
            const byHost = new Map<string, { gpu: number; util: number }[]>();
            for (const item of items) {
              const labels = item.metric?.labels ?? {};
              const host = hostOf(labels);
              const value = extractNumericValue(item.value as never);
              if (!host || !Number.isFinite(value)) continue;
              const list = byHost.get(host) ?? [];
              list.push({ gpu: Number(labels.gpu ?? labels.GPU_I_ID ?? list.length), util: Math.round(value) });
              byHost.set(host, list);
            }
            for (const [host, list] of byHost) {
              entry(host).gpuUtil = list.sort((a, b) => a.gpu - b.gpu).map((g) => g.util);
            }
          })
          .catch(() => {})
      : Promise.resolve(),

    prom
      .rangeQuery("node_load1 * on(instance) group_left(nodename) node_uname_info", start, end, 300)
      .then((res) => {
        for (const item of (res?.result ?? []) as SeriesItem[]) {
          const host = hostOf(item.metric?.labels ?? {});
          if (host && item.values?.length) entry(host).load = item.values.map((v) => Math.round(v.value * 100) / 100);
        }
      })
      .catch(() => {}),
  ]);

  const body = { enabled: true, nodes };
  cached = { at: Date.now(), body };
  return NextResponse.json(body);
}
