import { appendFile } from "node:fs/promises";
import { readEnv, readFlag } from "@/lib/config";
import { getFeatures } from "@/lib/features";
import { nodeState, type NodeState } from "@/lib/node-history";
import { fetchIpmiPower } from "@/lib/node-power";
import type { SlurmNode } from "@/lib/nodes";
import { parseGPUResources } from "@/utils/gpu-parse";

// JSON lines for other systems (Telegraf, Vector, Fluent Bit, Promtail) to
// pick up: node state changes as they're seen, and node and cluster metrics
// every interval. EVENT_LOG is "stdout" or a file path; unset, nothing is written.

export interface EventLogConfig {
  target: string;
  intervalS: number;
  metrics: boolean;
}

export function eventLogConfig(): EventLogConfig | null {
  const target = readEnv("EVENT_LOG");
  if (!target || target === "off") return null;
  const interval = Number(readEnv("EVENT_LOG_INTERVAL_SECONDS"));
  return {
    target,
    intervalS: Number.isFinite(interval) && interval >= 10 ? interval : 60,
    metrics: readFlag("EVENT_LOG_METRICS") ?? true,
  };
}

type Event = Record<string, string | number | boolean | undefined>;

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Slurm 23.11+ wraps some numbers as { set, infinite, number }
  if (value && typeof value === "object" && "number" in value) {
    const v = value as { set?: boolean; number?: unknown };
    return v.set === false ? 0 : num(v.number);
  }
  return 0;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

function gpus(node: SlurmNode): { total: number; used: number } {
  const gres = str(node.gres);
  if (!gres) return { total: 0, used: 0 };
  const { gpuTotal, gpuUsed } = parseGPUResources(gres, str(node.gres_used));
  return { total: gpuTotal, used: Math.min(gpuUsed, gpuTotal) };
}

export class EventLog {
  private states = new Map<string, NodeState>();
  private lastMetricsAt = 0;

  constructor(private config: EventLogConfig) {}

  private async write(events: Event[]) {
    if (events.length === 0) return;
    const text = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    if (this.config.target === "stdout") process.stdout.write(text);
    else await appendFile(this.config.target, text);
  }

  // Called with every nodes fetch; state changes go out each time, metrics once an interval
  async record(cluster: string, nodes: SlurmNode[], now = new Date()) {
    const time = now.toISOString();
    const events: Event[] = [];

    const seen = new Set<string>();
    for (const node of nodes) {
      const name = node.name ?? node.hostname;
      if (!name) continue;
      seen.add(name);
      const state = nodeState(node);
      const previous = this.states.get(name);
      this.states.set(name, state);
      // The first fetch only learns the states
      if (previous && previous !== state) {
        events.push({
          time,
          event: "node_state",
          cluster,
          node: name,
          state,
          previous,
          slurm_state: [node.state ?? []].flat().join("+"),
          reason: str(node.reason) || undefined,
        });
      }
    }
    for (const name of this.states.keys()) if (!seen.has(name)) this.states.delete(name);

    if (this.config.metrics && now.getTime() - this.lastMetricsAt >= this.config.intervalS * 1000 - 1000) {
      this.lastMetricsAt = now.getTime();
      events.push(...(await this.metrics(time, cluster, nodes)));
    }
    await this.write(events);
  }

  private async metrics(time: string, cluster: string, nodes: SlurmNode[]): Promise<Event[]> {
    const ipmi = (await getFeatures()).prometheus.enabled ? await fetchIpmiPower().catch(() => new Map<string, number>()) : new Map();
    const events: Event[] = [];
    const total: Event = { time, event: "cluster_metrics", cluster, nodes: 0 };
    const add = (key: string, value: number) => (total[key] = num(total[key]) + value);
    let powered = false;

    for (const node of nodes) {
      const name = node.name ?? node.hostname;
      if (!name) continue;
      const state = nodeState(node);
      const cpus = num(node.cpus);
      const gpu = gpus(node);
      // IPMI when Prometheus has it, Slurm's energy plugin otherwise
      const slurmWatts = num((node.energy as { current_watts?: unknown } | undefined)?.current_watts);
      const watts = ipmi.get(name) ?? ipmi.get(str(node.hostname)) ?? (slurmWatts > 0 ? slurmWatts : undefined);
      const memory = num(node.real_memory);
      events.push({
        time,
        event: "node_metrics",
        cluster,
        node: name,
        state,
        cpus,
        cpus_alloc: num(node.alloc_cpus),
        // Slurm reports load scaled by 100
        cpu_load: num(node.cpu_load) / 100,
        memory_mb: memory,
        memory_alloc_mb: num(node.alloc_memory),
        memory_free_mb: num(node.free_mem),
        gpus: gpu.total || undefined,
        gpus_alloc: gpu.total ? gpu.used : undefined,
        power_watts: watts,
      });
      add("nodes", 1);
      add(`nodes_${state}`, 1);
      add("cpus", cpus);
      add("cpus_alloc", num(node.alloc_cpus));
      add("memory_mb", memory);
      add("memory_alloc_mb", num(node.alloc_memory));
      add("gpus", gpu.total);
      add("gpus_alloc", gpu.used);
      if (watts !== undefined) {
        powered = true;
        add("power_watts", watts);
      }
    }
    if (!powered) delete total.power_watts;
    if (events.length) events.push(total);
    return events;
  }
}
