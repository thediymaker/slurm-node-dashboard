"use client";

import { memo, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FeatureSelector, { LogicType } from "@/components/feature-selector";
import { cn } from "@/lib/utils";
import type { GroupBy } from "./node-grid";
import { type CardSize, STATE_LABELS, STATE_ORDER } from "./node-view";

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex gap-0.5 rounded-lg border bg-muted/40 p-[3px]">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
              o.value === value && "bg-background font-medium text-foreground shadow-sm"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface NodeToolbarProps {
  partitions: string[];
  features: string[];
  partition: string;
  state: string;
  nodeType: string;
  selectedFeatures: string[];
  featureLogicType: LogicType;
  groupBy: GroupBy;
  hasRacks: boolean;
  size: CardSize;
  showing: number;
  total: number;
  highlightQuery: string;
  onPartition: (value: string) => void;
  onState: (value: string) => void;
  onNodeType: (value: string) => void;
  onFeatures: (features: string[], logicType: LogicType) => void;
  onGroupBy: (value: GroupBy) => void;
  onSize: (value: CardSize) => void;
  onHighlight: (query: string | null) => void;
}

const trigger = "h-8 w-auto min-w-[120px] gap-2 text-[13px]";

// Highlight the nodes a user's or job's running jobs are on
function HighlightInput({ initial, onSubmit }: { initial: string; onSubmit: (query: string | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value || null);
      }}
      className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 focus-within:ring-1 focus-within:ring-ring"
    >
      <LocateFixed className="h-3.5 w-3.5 flex-none text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Highlight user or job"
        aria-label="Highlight the nodes a user or job is running on"
        className="w-[150px] bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

const NodeToolbar = (p: NodeToolbarProps) => {
  const groupOptions: { value: GroupBy; label: string }[] = [
    ...(p.hasRacks ? [{ value: "rack" as const, label: "Rack" }] : []),
    { value: "partition", label: "Partition" },
    { value: "state", label: "State" },
    { value: "none", label: "None" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={p.partition} onValueChange={p.onPartition}>
        <SelectTrigger className={trigger} aria-label="Partition">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="all" className="text-xs">Partition: all</SelectItem>
          {p.partitions.map((partition) => (
            <SelectItem key={partition} value={partition} className="text-xs">
              {partition}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={p.state} onValueChange={p.onState}>
        <SelectTrigger className={trigger} aria-label="State">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[340px]">
          <SelectItem value="all" className="text-xs">State: all</SelectItem>
          <SelectItem value="attention" className="text-xs">Needs attention</SelectItem>
          <SelectItem value="overloaded" className="text-xs">Overloaded</SelectItem>
          {STATE_ORDER.filter((s) => s !== "other").map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {STATE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={p.nodeType} onValueChange={p.onNodeType}>
        <SelectTrigger className={trigger} aria-label="Node type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Type: all</SelectItem>
          <SelectItem value="gpu" className="text-xs">GPU nodes</SelectItem>
          <SelectItem value="cpu" className="text-xs">CPU nodes</SelectItem>
        </SelectContent>
      </Select>

      <FeatureSelector
        features={p.features}
        selectedFeatures={p.selectedFeatures}
        onFeaturesChange={p.onFeatures}
        logicType={p.featureLogicType}
      />

      <HighlightInput key={p.highlightQuery} initial={p.highlightQuery} onSubmit={p.onHighlight} />

      <div className="ml-2">
        <Segmented label="Group by" value={p.groupBy} options={groupOptions} onChange={p.onGroupBy} />
      </div>

      {/* Kept together so it wraps as one piece */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {p.showing === p.total ? `${p.total} nodes` : `${p.showing} of ${p.total} nodes`}
        </span>
        <Segmented
          label="Size"
          value={p.size}
          options={[
            { value: 50 as CardSize, label: "S" },
            { value: 100 as CardSize, label: "M" },
            { value: 150 as CardSize, label: "L" },
          ]}
          onChange={p.onSize}
        />
      </div>
    </div>
  );
};

export default memo(NodeToolbar);
