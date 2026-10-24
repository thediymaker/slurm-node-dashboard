"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIODS, type MetricsTab, type Period } from "@/lib/metrics/params";
import { MetricsFilter, type FilterOptions } from "@/components/metrics/metrics-filter";
import { useMetricsNav } from "@/components/metrics/metrics-nav";

const TAB_LABELS: Record<MetricsTab, string> = {
  overview: "Overview",
  explorer: "Explorer",
  efficiency: "Efficiency",
  jobs: "Jobs",
};

const PERIOD_LABELS: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

// Tabs, the period selector and the shared filter bar around the active tab
export function MetricsShell({ options, children }: { options: FilterOptions; children: React.ReactNode }) {
  const { params, period, pending, navigate } = useMetricsNav();
  // Efficiency and Jobs don't chart over time
  const showPeriod = params.tab === "overview" || params.tab === "explorer";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b">
        <nav className="flex gap-5" aria-label="Metrics">
          {(Object.keys(TAB_LABELS) as MetricsTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-current={params.tab === tab ? "page" : undefined}
              onClick={() => navigate((p) => ({ ...p, tab }))}
              className={cn(
                "text-sm py-2.5 -mb-px border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors",
                params.tab === tab && "text-foreground border-foreground"
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />}
        <div className="flex-1" />
        {showPeriod && (
          <div role="group" aria-label="Period" className="flex gap-0.5 rounded-lg border bg-card p-0.5 my-1.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => navigate((prev) => ({ ...prev, period: p }))}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground",
                  period === p && "bg-muted text-foreground"
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      <MetricsFilter options={options} />

      <div className={cn("flex flex-col gap-4 transition-opacity", pending && "opacity-60")}>{children}</div>
    </div>
  );
}
