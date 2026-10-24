import { nodeState, type NodeState } from "@/lib/node-history";
import { getColorSchema } from "@/lib/color-schemas";

// Shared helpers for the nodes page: one state per node (the same states the
// history bar records), their labels and colors, and rack range expansion

export type CardSize = 50 | 100 | 150;

// Minimum tile width per size; the grid stretches tiles to fill each row
export const TILE_WIDTH: Record<CardSize, number> = { 50: 60, 100: 104, 150: 144 };

export const STATE_LABELS: Record<NodeState, string> = {
  allocated: "Full",
  mixed: "Partial",
  idle: "Idle",
  draining: "Draining",
  drained: "Drained",
  down: "Down",
  maintenance: "Maintenance",
  reserved: "Reserved",
  powered_down: "Powered down",
  other: "Other",
};

// Display order for the summary bar, legends and group-by-state
export const STATE_ORDER: NodeState[] = [
  "allocated",
  "mixed",
  "idle",
  "reserved",
  "draining",
  "drained",
  "maintenance",
  "down",
  "powered_down",
  "other",
];

export const ATTENTION_STATES: NodeState[] = ["down", "drained", "draining", "maintenance"];

export function stateOf(node: any): NodeState {
  return nodeState(node);
}

export function stateColors(colorSchema: string): Record<NodeState, string> {
  const p = getColorSchema(colorSchema).progressColors;
  return {
    allocated: p.allocated,
    mixed: p.mixed,
    idle: p.idle,
    draining: p.drain,
    drained: p.drain,
    down: p.down,
    maintenance: "#78716c",
    reserved: "#3730a3",
    powered_down: "#52525b",
    other: "#71717a",
  };
}

// cpu_load from the Slurm API is scaled by 100 (3025 = 30.25)
export function loadRatio(node: any): number {
  const raw = typeof node.cpu_load === "number" ? node.cpu_load : node.cpu_load?.number ?? 0;
  return node.cpus ? raw / 100 / node.cpus : 0;
}

export const OVERLOAD_RATIO = 1.25;

export function isOverloaded(node: any): boolean {
  return loadRatio(node) > OVERLOAD_RATIO;
}

export function needsAttention(node: any): boolean {
  return ATTENTION_STATES.includes(stateOf(node)) || isOverloaded(node);
}

// "node[01..04]"-style rack entries: "node01..04" expands to node01, node02...
export function expandNodeRange(nodeRange: string): string[] {
  if (!nodeRange.includes("..")) return [nodeRange];
  const [prefix, rangeEnd] = nodeRange.split("..");
  const startMatch = prefix.match(/(\d+)$/);
  if (!startMatch) return [nodeRange];
  const startStr = startMatch[1];
  const start = parseInt(startStr, 10);
  const end = parseInt(rangeEnd, 10);
  if (isNaN(end)) return [nodeRange];
  const base = prefix.slice(0, prefix.length - startStr.length);
  const names: string[] = [];
  for (let i = start; i <= end; i++) names.push(`${base}${i.toString().padStart(startStr.length, "0")}`);
  return names;
}

// GPU indexes in use from gres_used, e.g. "gpu:a100:3(IDX:0-1,3)"; null when
// Slurm doesn't say which
export function usedGpuIndexes(gresUsed: string | undefined): Set<number> | null {
  if (!gresUsed) return null;
  const found = new Set<number>();
  let sawIdx = false;
  for (const match of gresUsed.matchAll(/gpu:[^,(]*\(IDX:([^)]*)\)/g)) {
    sawIdx = true;
    for (const part of match[1].split(",")) {
      if (!part || part === "N/A") continue;
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      if (isNaN(a)) continue;
      for (let i = a; i <= (isNaN(b) ? a : b); i++) found.add(i);
    }
  }
  return sawIdx ? found : null;
}

export function formatPower(watts: number): string {
  return watts >= 1000 ? `${(watts / 1000).toFixed(1)} kW` : `${Math.round(watts)} W`;
}

// Short host name, matching how /api/nodes/extras keys its nodes
export function shortName(name: string): string {
  return name.split(".")[0];
}
