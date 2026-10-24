"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NodeConfig } from "@/types/types";
import type { NodeExtras } from "@/app/api/nodes/extras/route";
import type { NodeState } from "@/lib/node-history";
import { cn } from "@/lib/utils";
import { NodeCard } from "./node-card";
import {
  type CardSize,
  STATE_LABELS,
  STATE_ORDER,
  TILE_WIDTH,
  expandNodeRange,
  shortName,
  stateColors,
  stateOf,
} from "./node-view";

export type GroupBy = "rack" | "partition" | "state" | "none";

interface GridOptions {
  size: CardSize;
  colorSchema: string;
  extras?: Record<string, NodeExtras>;
  changed?: Set<string>;
  // Nodes to ring; every other node is dimmed while this is set
  highlighted?: Set<string>;
  tempWarn?: number;
  historical?: boolean;
}

// Square tiles that stretch to fill each row, so there's no ragged gap on the right
export const NodeGrid = memo(({ nodes, size, colorSchema, extras, changed, highlighted, tempWarn, historical }: GridOptions & { nodes: any[] }) => (
  <div
    className="grid"
    style={{
      gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_WIDTH[size]}px, 1fr))`,
      gap: size === 50 ? 3 : 6,
    }}
  >
    {nodes.map((node) => (
      <NodeCard
        key={node.hostname ?? node.name}
        size={size}
        name={node.name ?? node.hostname}
        load={node.cpu_load?.number ?? node.cpu_load}
        partitions={node.partitions}
        features={node.features || []}
        coresTotal={node.cpus}
        coresUsed={node.alloc_cpus}
        memoryTotal={node.real_memory}
        memoryUsed={node.alloc_memory}
        status={node.state}
        nodeData={node}
        colorSchema={colorSchema}
        extras={extras?.[shortName(node.name ?? node.hostname ?? "")]}
        changed={changed?.has(node.name ?? node.hostname)}
        highlight={highlighted ? highlighted.has(node.name ?? node.hostname) : undefined}
        tempWarn={tempWarn}
        historical={historical}
      />
    ))}
  </div>
));
NodeGrid.displayName = "NodeGrid";

interface Group {
  key: string;
  name: string;
  description?: string;
  nodes: any[];
}

function buildGroups(nodes: any[], groupBy: GroupBy, rackConfig: NodeConfig | undefined): Group[] {
  if (groupBy === "partition") {
    const byPartition = new Map<string, any[]>();
    for (const node of nodes) {
      for (const p of node.partitions?.length ? node.partitions : ["(none)"]) {
        if (!byPartition.has(p)) byPartition.set(p, []);
        byPartition.get(p)!.push(node);
      }
    }
    return [...byPartition.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, list]) => ({ key: `partition:${p}`, name: p, nodes: list }));
  }

  if (groupBy === "state") {
    const byState = new Map<NodeState, any[]>();
    for (const node of nodes) {
      const s = stateOf(node);
      if (!byState.has(s)) byState.set(s, []);
      byState.get(s)!.push(node);
    }
    return STATE_ORDER.filter((s) => byState.has(s)).map((s) => ({
      key: `state:${s}`,
      name: STATE_LABELS[s],
      nodes: byState.get(s)!,
    }));
  }

  if (groupBy === "rack" && rackConfig && Object.keys(rackConfig).length > 0) {
    const byName = new Map(nodes.map((n) => [n.hostname ?? n.name, n]));
    const placed = new Set<string>();
    const groups: Group[] = Object.entries(rackConfig).map(([rack, { nodes: ranges, description }]) => {
      const list: any[] = [];
      for (const range of ranges) {
        for (const name of expandNodeRange(range)) {
          const node = byName.get(name);
          if (node && !placed.has(name)) {
            placed.add(name);
            list.push(node);
          }
        }
      }
      return { key: `rack:${rack}`, name: rack, description, nodes: list };
    });
    const rest = nodes.filter((n) => !placed.has(n.hostname ?? n.name));
    if (rest.length) groups.push({ key: "rack:(other)", name: "Other", description: "Not in a rack", nodes: rest });
    return groups;
  }

  return [{ key: "all", name: "", nodes }];
}

function MiniStateBar({ nodes, colorSchema }: { nodes: any[]; colorSchema: string }) {
  const colors = stateColors(colorSchema);
  const counts = new Map<NodeState, number>();
  for (const n of nodes) counts.set(stateOf(n), (counts.get(stateOf(n)) ?? 0) + 1);
  return (
    <div className="hidden h-1.5 w-[120px] gap-px overflow-hidden rounded-full sm:flex" aria-hidden>
      {STATE_ORDER.filter((s) => counts.has(s)).map((s) => (
        <div key={s} style={{ flex: counts.get(s), background: colors[s] }} />
      ))}
    </div>
  );
}

const COLLAPSED_KEY = "collapsedNodeGroups";

export function NodeGroups({
  nodes,
  groupBy,
  rackConfig,
  ...options
}: GridOptions & { nodes: any[]; groupBy: GroupBy; rackConfig?: NodeConfig }) {
  const groups = useMemo(() => buildGroups(nodes, groupBy, rackConfig).filter((g) => g.nodes.length > 0), [nodes, groupBy, rackConfig]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      // Private windows can refuse storage
    }
  }, [collapsed]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (groups.length === 1 && groups[0].key === "all") {
    return <NodeGrid nodes={groups[0].nodes} {...options} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const open = !collapsed.has(group.key);
        const busy = group.nodes.filter((n) => {
          const s = stateOf(n);
          return s === "allocated" || s === "mixed" || s === "draining";
        }).length;
        return (
          <section key={group.key} aria-label={group.name} className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => toggle(group.key)}
              aria-expanded={open}
              className="group flex items-center gap-3 text-left"
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 flex-none text-muted-foreground transition-transform", !open && "-rotate-90")}
              />
              <h2 className="text-sm font-semibold">{group.name}</h2>
              {group.description && (
                <span className="hidden truncate text-xs text-muted-foreground md:inline">{group.description}</span>
              )}
              <div className="h-px flex-1 bg-border" />
              <MiniStateBar nodes={group.nodes} colorSchema={options.colorSchema} />
              <span className="font-mono text-xs text-muted-foreground">
                {busy}/{group.nodes.length} busy
              </span>
            </button>
            {open && <NodeGrid nodes={group.nodes} {...options} />}
          </section>
        );
      })}
    </div>
  );
}
