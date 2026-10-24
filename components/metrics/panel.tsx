"use client";

import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/components/metrics/format";

type Cell = string | number | null | undefined;

export interface CsvData {
  filename: string;
  header: string[];
  rows: Cell[][];
}

// A metrics card: title, a short description, actions on the right
export function Panel({
  title,
  description,
  csv,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  csv?: CsvData | (() => CsvData);
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card text-card-foreground p-4 flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
        <div className="flex-1" />
        {actions}
        {csv && <CsvButton csv={csv} />}
      </div>
      {children}
    </section>
  );
}

export function CsvButton({ csv, label = "CSV" }: { csv: CsvData | (() => CsvData); label?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-muted-foreground"
      onClick={() => {
        const d = typeof csv === "function" ? csv() : csv;
        downloadCsv(d.filename, d.header, d.rows);
      }}
    >
      <Download className="h-3.5 w-3.5 mr-1" />
      {label}
    </Button>
  );
}

// The one quiet line that stands in for panels with nothing to show
export function QuietNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground px-1">
      <Info className="h-3.5 w-3.5 mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  title,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card text-card-foreground px-4 py-3 flex flex-col gap-1" title={title}>
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className="text-2xl font-semibold tabular-nums truncate">{value}</span>
      {sub !== undefined && <span className="text-xs text-muted-foreground truncate">{sub}</span>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">{children}</div>
  );
}
