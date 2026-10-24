"use client";

import React, { memo, useMemo } from "react";
import useSWR from "swr";
import type { NodeState } from "@/lib/node-history";
import type { SlurmDiag } from "@/types/types";
import { withBasePath } from "@/lib/base-path";
import { parseGPUResources } from "@/utils/gpu-parse";
import { cn } from "@/lib/utils";
import { STATE_LABELS, STATE_ORDER, formatPower, isOverloaded, needsAttention, stateColors, stateOf } from "./node-view";
import { useFeature } from "@/components/runtime-config";

const diagFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

interface ClusterSummaryProps {
  nodes: any[];
  colorSchema: string;
  lastUpdate?: number;
  connectionError?: boolean;
  // The state filter currently applied, so the legend can show it selected
  stateFilter: string;
  onStateFilter: (value: string) => void;
}

function Kpi({ label, value, sub, onClick, active }: { label: string; value: string; sub: string; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[22px] font-semibold leading-tight tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-1 border-border lg:border-l lg:pl-5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, "rounded-sm hover:opacity-80", active && "underline decoration-2 underline-offset-4")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const ClusterSummary = ({ nodes, colorSchema, lastUpdate, connectionError, stateFilter, onStateFilter }: ClusterSummaryProps) => {
  // Same key as the footer, so SWR shares one request
  const { data: diag } = useSWR<SlurmDiag | null>(withBasePath("/api/slurm/diag"), diagFetcher, { refreshInterval: 15000 });
  // Cluster power from IPMI in Prometheus; Slurm's node energy readings otherwise
  const prometheus = useFeature("prometheus");
  const { data: ipmi } = useSWR<{ status: number; summary?: { currentTotal?: number; noPrometheusData?: boolean } } | null>(
    prometheus ? withBasePath("/api/prometheus/ipmi") : null,
    diagFetcher,
    { refreshInterval: 60000 }
  );

  const summary = useMemo(() => {
    const counts = new Map<NodeState, number>();
    let memUsed = 0;
    let memTotal = 0;
    let slurmWatts = 0;
    let coresUsed = 0;
    let coresTotal = 0;
    let gpusUsed = 0;
    let gpusTotal = 0;
    let attention = 0;
    let overloaded = 0;
    for (const node of nodes) {
      const s = stateOf(node);
      counts.set(s, (counts.get(s) ?? 0) + 1);
      coresUsed += node.alloc_cpus || 0;
      coresTotal += node.cpus || 0;
      memUsed += node.alloc_memory || 0;
      memTotal += node.real_memory || 0;
      if (node.energy?.current_watts?.set !== false && node.energy?.current_watts?.number > 0) slurmWatts += node.energy.current_watts.number;
      const gpu = parseGPUResources(node.gres, node.gres_used);
      gpusUsed += gpu?.gpuUsed || 0;
      gpusTotal += gpu?.gpuTotal || 0;
      if (needsAttention(node)) attention++;
      if (isOverloaded(node)) overloaded++;
    }
    return { counts, coresUsed, coresTotal, memUsed, memTotal, slurmWatts, gpusUsed, gpusTotal, attention, overloaded };
  }, [nodes]);

  const colors = stateColors(colorSchema);
  const segments = STATE_ORDER.filter((s) => summary.counts.has(s));
  const stats = (diag as any)?.statistics;
  const updated = lastUpdate ? new Date(lastUpdate * 1000).toLocaleTimeString() : undefined;
  const ipmiWatts = ipmi?.status === 200 && !ipmi.summary?.noPrometheusData ? ipmi.summary?.currentTotal : undefined;
  const watts = ipmiWatts && ipmiWatts > 0 ? ipmiWatts : summary.slurmWatts > 0 ? summary.slurmWatts : undefined;
  const tib = (mb: number) => (mb >= 1024 * 1024 ? `${(mb / 1024 / 1024).toFixed(1)} TB` : `${Math.round(mb / 1024).toLocaleString()} GB`);
  const kpis = [
    {
      label: "Cores allocated",
      value: `${summary.coresTotal ? Math.round((summary.coresUsed / summary.coresTotal) * 100) : 0}%`,
      sub: `${summary.coresUsed.toLocaleString()} of ${summary.coresTotal.toLocaleString()}`,
    },
    {
      label: "Memory allocated",
      value: `${summary.memTotal ? Math.round((summary.memUsed / summary.memTotal) * 100) : 0}%`,
      sub: `${tib(summary.memUsed)} of ${tib(summary.memTotal)}`,
    },
    ...(summary.gpusTotal > 0
      ? [{
          label: "GPUs allocated",
          value: `${summary.gpusUsed}/${summary.gpusTotal}`,
          sub: `${Math.round((summary.gpusUsed / summary.gpusTotal) * 100)}% in use`,
        }]
      : []),
    ...(watts ? [{ label: "Power", value: formatPower(watts), sub: ipmiWatts ? "from IPMI" : "from Slurm" }] : []),
    {
      label: "Jobs running",
      value: stats?.jobs_running !== undefined ? Number(stats.jobs_running).toLocaleString() : "–",
      sub: stats?.jobs_pending !== undefined ? `${Number(stats.jobs_pending).toLocaleString()} pending` : "Waiting for slurmctld",
    },
  ];

  return (
    <section
      aria-label="Cluster summary"
      className="grid grid-cols-2 gap-5 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:items-center lg:[grid-template-columns:var(--summary-cols)]"
      style={{ "--summary-cols": `minmax(0,2fr) repeat(${kpis.length + 1}, minmax(0,1fr))` } as React.CSSProperties}
    >
      <div className="col-span-2 flex flex-col gap-2.5 sm:col-span-3 lg:col-span-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{nodes.length} nodes</span>
          {connectionError ? (
            <span className="text-destructive">Can&apos;t reach the server · showing {updated ?? "cached data"}</span>
          ) : (
            updated && <span>Updated {updated}</span>
          )}
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {segments.map((s) => (
            <div key={s} style={{ flex: summary.counts.get(s), background: colors[s] }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs">
          {segments.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStateFilter(stateFilter === s ? "all" : s)}
              aria-pressed={stateFilter === s}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm text-foreground/85 hover:text-foreground",
                stateFilter === s && "font-semibold text-foreground"
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colors[s] }} />
              {STATE_LABELS[s]}
              <span className="font-mono text-muted-foreground">{summary.counts.get(s)}</span>
            </button>
          ))}
        </div>
      </div>
      {kpis.map((k) => (
        <Kpi key={k.label} {...k} />
      ))}
      <Kpi
        label="Needs attention"
        value={String(summary.attention)}
        sub={summary.overloaded ? `drained, down, maint or ${summary.overloaded} overloaded` : "drained, down or maint"}
        onClick={() => onStateFilter(stateFilter === "attention" ? "all" : "attention")}
        active={stateFilter === "attention"}
      />
    </section>
  );
};

export default memo(ClusterSummary);
