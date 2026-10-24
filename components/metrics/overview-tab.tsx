"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHierarchyLabels } from "@/components/runtime-config";
import type { OverviewData } from "@/lib/metrics/load";
import { WALL_USED_BUCKETS } from "@/lib/metrics/overview";
import type { ExplorerResult } from "@/lib/metrics/explorer";
import { useMetricsNav } from "@/components/metrics/metrics-nav";
import { EmptyState, KpiTile, Panel, QuietNote } from "@/components/metrics/panel";
import {
  ColumnHistogram,
  Legend,
  RankedBars,
  StackedTimeChart,
  UtilizationChart,
  UtilizationLegend,
  type UtilizationPoint,
} from "@/components/metrics/charts";
import {
  PERIOD_NOUN,
  bucketLabel,
  fmtChange,
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtPct,
  seriesColor,
  stateDotClass,
  stateLabel,
} from "@/components/metrics/format";

function change(current: number | null, previous: number | null, kind: "relative" | "points" = "relative") {
  const c = fmtChange(current, previous, kind);
  return c ? `${c} vs prior` : "no prior data";
}

function seriesLabel(key: string, other: boolean) {
  return other ? "Other" : key;
}

export function OverviewTab({ data }: { data: OverviewData }) {
  const { params, period, hierarchy, navigate, fromDate, toDate } = useMetricsNav();
  const { level1, level2 } = useHierarchyLabels();
  const { current: k, previous: pk } = data.kpis;
  const range = `${fromDate}_${toDate}`;

  if (k.jobs === 0 && k.cpuHours === 0) {
    return <EmptyState>No jobs ran in this range with these filters.</EmptyState>;
  }

  const waitChange =
    k.medianWaitSeconds !== null && pk.medianWaitSeconds !== null
      ? `${k.medianWaitSeconds >= pk.medianWaitSeconds ? "+" : "−"}${fmtDuration(Math.abs(k.medianWaitSeconds - pk.medianWaitSeconds))} vs prior`
      : "no prior data";

  const notes: string[] = [];
  const util = data.utilization;
  if (util.buckets.length === 0) {
    notes.push(
      "Utilization is hidden because no cluster capacity was recorded in this range (the dashboard records it with node history)."
    );
  }
  if (!hierarchy) {
    notes.push(
      `${level1} and ${level2.toLowerCase()} panels are hidden because no accounts are mapped to the hierarchy (Admin → Hierarchy).`
    );
  }
  if (data.gpu.length === 0) notes.push("GPU charts are hidden because no jobs in this range used GPUs.");

  return (
    <>
      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        <KpiTile label="CPU hours" value={fmtNum(k.cpuHours)} sub={change(k.cpuHours, pk.cpuHours)} />
        <KpiTile label="GPU hours" value={fmtNum(k.gpuHours)} sub={change(k.gpuHours, pk.gpuHours)} />
        <KpiTile label="Node hours" value={fmtNum(k.nodeHours)} sub={change(k.nodeHours, pk.nodeHours)} />
        <KpiTile label="Jobs" value={fmtInt(k.jobs)} sub={change(k.jobs, pk.jobs)} />
        <KpiTile label="Active users" value={fmtInt(k.users)} sub={`${fmtInt(k.accounts)} accounts`} />
        <KpiTile label="Median wait" value={fmtDuration(k.medianWaitSeconds)} sub={waitChange} />
        <KpiTile
          label="Utilization"
          value={util.percent === null ? "—" : `${util.percent.toFixed(0)}%`}
          sub={util.percent === null ? "no capacity data" : change(util.percent, data.previousUtilization, "points")}
          title="Allocated core hours ÷ core hours on nodes that could run jobs"
        />
      </div>

      {util.buckets.length > 0 && <UtilizationPanel data={data} range={range} />}

      {data.colleges && <CollegePanel result={data.colleges} drill={params.drill} range={range} />}

      <div className={hierarchy && data.departments ? "grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid gap-4"}>
        <Panel
          title="Top accounts"
          description="by CPU hours"
          actions={
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs"
              onClick={() =>
                navigate((p) => ({ ...p, tab: "explorer", explorer: { metric: "cpuHours", group: "account", view: "table" } }))
              }
            >
              Open in Explorer
            </Button>
          }
          csv={() => ({
            filename: `top-accounts_${range}`,
            header: ["account", level2.toLowerCase(), "cpu_hours", "gpu_hours", "jobs", "users", "avg_wait_seconds"],
            rows: data.accounts.map((a) => [a.account, a.department, a.cpuHours, a.gpuHours, a.jobs, a.users, a.avgWaitSeconds]),
          })}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums whitespace-nowrap">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left font-normal pb-1.5">Account</th>
                  {hierarchy && <th className="text-left font-normal pb-1.5">{level2}</th>}
                  <th className="text-right font-normal pb-1.5">CPU h</th>
                  <th className="text-right font-normal pb-1.5">GPU h</th>
                  <th className="text-right font-normal pb-1.5">Jobs</th>
                  <th className="text-right font-normal pb-1.5">Users</th>
                  <th className="text-right font-normal pb-1.5">Avg wait</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.account} className="border-t">
                    <td className="py-1.5 pr-2 font-mono text-xs max-w-[12rem] truncate">{a.account}</td>
                    {hierarchy && (
                      <td className="py-1.5 pr-2 text-muted-foreground max-w-[12rem] truncate">{a.department ?? "—"}</td>
                    )}
                    <td className="py-1.5 text-right">{fmtNum(a.cpuHours)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtNum(a.gpuHours)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtInt(a.jobs)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtInt(a.users)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtDuration(a.avgWaitSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {hierarchy && data.departments && data.departments.series.length > 0 && (
          <Panel
            title={`By ${level2.toLowerCase()}`}
            description="CPU hours"
            csv={() => ({
              filename: `cpu-hours-by-${level2.toLowerCase()}_${range}`,
              header: [level2.toLowerCase(), "cpu_hours", "share"],
              rows: data.departments!.series.filter((s) => !s.other).map((s) => [s.key, s.total, s.share]),
            })}
          >
            <RankedBars
              rows={data.departments.series
                .filter((s) => !s.other)
                .map((s) => ({ key: s.key, label: s.key, value: s.total ?? 0, display: fmtNum(s.total) }))}
              onClick={(key) =>
                key !== "(unmapped)" && navigate((p) => ({ ...p, filters: { ...p.filters, departments: [key] } }))
              }
            />
          </Panel>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Job size"
          description="CPU hours by cores per job"
          csv={() => ({
            filename: `job-size_${range}`,
            header: ["cores_per_job", "cpu_hours", "share"],
            rows: data.jobSize.series.map((s) => [s.key, s.total, s.share]),
          })}
        >
          <ColumnHistogram
            color="hsl(var(--chart-1))"
            bins={data.jobSize.series.map((s) => ({
              label: s.key,
              value: s.total ?? 0,
              display: fmtNum(s.total),
              title: `${s.key} cores: ${fmtNum(s.total)} CPU hours (${fmtPct(s.share)})`,
            }))}
          />
        </Panel>
        <Panel
          title="Wall time used"
          description="jobs by share of their time limit"
          csv={() => ({
            filename: `wall-time-used_${range}`,
            header: ["share_of_limit", "jobs"],
            rows: WALL_USED_BUCKETS.map((b, i) => [b, data.wallTime.counts[i] ?? 0]),
          })}
        >
          <ColumnHistogram
            color="hsl(var(--chart-3))"
            bins={WALL_USED_BUCKETS.map((b, i) => ({
              label: b,
              value: data.wallTime.counts[i] ?? 0,
              display: fmtNum(data.wallTime.counts[i] ?? 0),
            }))}
          />
          {data.wallTime.median !== null && (
            <span className="text-xs text-muted-foreground">
              The median job used {fmtPct(data.wallTime.median)} of its time limit. Tighter limits help backfill.
            </span>
          )}
        </Panel>
        <Panel
          title="Queue wait"
          description="median and 90th percentile"
          csv={() => ({
            filename: `queue-wait_${range}`,
            header: ["partition", "jobs", "p50_seconds", "p90_seconds"],
            rows: data.queueWait.map((w) => [w.partition, w.jobs, w.p50, w.p90]),
          })}
        >
          <QueueWait rows={data.queueWait} />
        </Panel>
      </div>

      <div className={data.gpu.length > 0 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        <OutcomesPanel data={data} range={range} />
        {data.gpu.length > 0 && (
          <Panel
            title="GPU hours by partition"
            description="and average GPU utilization while allocated"
            csv={() => ({
              filename: `gpu-hours-by-partition_${range}`,
              header: ["partition", "gpu_hours", "avg_gpu_utilization_percent"],
              rows: data.gpu.map((g) => [g.partition, g.gpuHours, g.utilization]),
            })}
          >
            <GpuRows rows={data.gpu} />
          </Panel>
        )}
      </div>

      {data.preemption.preempted > 0 && (
        <Panel
          title="Preemption by node"
          description={`${fmtInt(data.preemption.preempted)} of ${fmtInt(data.preemption.jobs)} jobs were preempted · nodes with the most`}
          csv={() => ({
            filename: `preemption-by-node_${range}`,
            header: ["node", "jobs", "preempted"],
            rows: data.preemption.nodes.map((n) => [n.node, n.jobs, n.preempted]),
          })}
        >
          <PreemptionRows rows={data.preemption.nodes} />
        </Panel>
      )}

      {notes.map((n) => (
        <QuietNote key={n}>{n}</QuietNote>
      ))}
      <p className="text-xs text-muted-foreground px-1">
        CPU, GPU and node hours are spread over the time each job ran; job counts, waits and outcomes count jobs that ended in the
        range. Each bar is one {PERIOD_NOUN[period]}.
      </p>
    </>
  );
}

function UtilizationPanel({ data, range }: { data: OverviewData; range: string }) {
  const { period, params } = useMetricsNav();
  const util = data.utilization;
  const byBucket = new Map(util.buckets.map((b) => [b.bucket, b]));
  const buckets = data.colleges?.buckets ?? data.jobSize.buckets;
  const points: UtilizationPoint[] = buckets.map((bucket) => {
    const b = byBucket.get(bucket);
    if (!b || b.total <= 0) return { bucket, allocated: null, idle: null, unavailable: null };
    return {
      bucket,
      allocated: b.allocated / b.total,
      idle: Math.max(0, b.available - b.allocated) / b.total,
      unavailable: Math.max(0, b.total - b.available) / b.total,
    };
  });
  const filtered =
    params.filters.accounts.length +
      params.filters.users.length +
      params.filters.colleges.length +
      params.filters.departments.length +
      params.filters.partitions.length +
      params.filters.qos.length >
    0;
  return (
    <Panel
      title="Utilization"
      description={
        <>
          {filtered ? "the selected jobs' allocated core hours" : "allocated core hours"} against what the cluster could deliver
          each {PERIOD_NOUN[period]}
          {util.since && ` · capacity recorded since ${bucketLabel(util.since.slice(0, 10), "day", true)}`}
        </>
      }
      actions={<UtilizationLegend />}
      csv={() => ({
        filename: `utilization_${range}`,
        header: ["period_start", "core_seconds_total", "core_seconds_available", "core_seconds_allocated", "utilization_percent"],
        rows: util.buckets.map((b) => [
          b.bucket,
          b.total,
          b.available,
          b.allocated,
          b.available > 0 ? (100 * b.allocated) / b.available : null,
        ]),
      })}
    >
      <UtilizationChart points={points} period={period} />
    </Panel>
  );
}

function CollegePanel({ result, drill, range }: { result: ExplorerResult; drill?: string; range: string }) {
  const { period, navigate } = useMetricsNav();
  const { level1, level2 } = useHierarchyLabels();
  const series = result.series.map((s, i) => ({
    key: s.key,
    label: seriesLabel(s.key, s.other),
    color: seriesColor(i, s.other),
    values: s.values,
  }));
  const canDrill = !drill;
  const onPick = (key: string) => {
    if (canDrill && key && key !== "(unmapped)") navigate((p) => ({ ...p, drill: key }));
  };
  return (
    <Panel
      title={drill ? `CPU hours by ${level2.toLowerCase()} in ${drill}` : `CPU hours by ${level1.toLowerCase()}`}
      description={
        drill
          ? `per ${PERIOD_NOUN[period]}`
          : `per ${PERIOD_NOUN[period]} · click a ${level1.toLowerCase()} to see its ${level2.toLowerCase()}s`
      }
      actions={
        <>
          <Legend
            items={series.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
            onClick={canDrill ? onPick : undefined}
          />
          {drill && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate((p) => ({ ...p, drill: undefined }))}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              All {level1.toLowerCase()}s
            </Button>
          )}
        </>
      }
      csv={() => ({
        filename: `cpu-hours-by-${drill ? level2.toLowerCase() : level1.toLowerCase()}_${range}`,
        header: ["period_start", ...series.map((s) => s.label)],
        rows: result.buckets.map((b, i) => [b, ...series.map((s) => s.values[i])]),
      })}
    >
      {series.length ? (
        <StackedTimeChart
          buckets={result.buckets}
          period={period}
          series={series}
          format={fmtNum}
          onSeriesClick={canDrill ? onPick : undefined}
          totalLabel="CPU hours"
        />
      ) : (
        <QuietNote>No CPU hours in this range.</QuietNote>
      )}
    </Panel>
  );
}

function QueueWait({ rows }: { rows: OverviewData["queueWait"] }) {
  const max = Math.max(...rows.map((r) => r.p90), 1);
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem_4rem] gap-2.5 text-[11px] uppercase tracking-wide text-muted-foreground pb-1">
        <span>Partition</span>
        <span />
        <span className="text-right">p50</span>
        <span className="text-right">p90</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.partition}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem_4rem] gap-2.5 items-center whitespace-nowrap text-sm py-1.5 border-t tabular-nums"
          title={`${r.partition}: ${fmtInt(r.jobs)} jobs, median ${fmtDuration(r.p50)}, 90th percentile ${fmtDuration(r.p90)}`}
        >
          <span className="font-mono text-xs truncate">{r.partition}</span>
          <span className="relative h-2 rounded-full bg-muted">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--chart-1)/0.35)]"
              style={{ width: `${(r.p90 / max) * 100}%` }}
            />
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--chart-1))]"
              style={{ width: `${Math.max(1, (r.p50 / max) * 100)}%` }}
            />
          </span>
          <span className="text-right">{fmtDuration(r.p50)}</span>
          <span className="text-right text-muted-foreground">{fmtDuration(r.p90)}</span>
        </div>
      ))}
    </div>
  );
}

function OutcomesPanel({ data, range }: { data: OverviewData; range: string }) {
  const { states, failedShare } = data.outcomes;
  const total = states.reduce((s, r) => s + r.jobs, 0);
  return (
    <Panel
      title="Job outcomes"
      description={
        <>
          {fmtInt(total)} jobs
          {failedShare !== null && ` · ${fmtPct(failedShare)} of CPU hours lost to failed or timed-out jobs`}
        </>
      }
      csv={() => ({
        filename: `job-outcomes_${range}`,
        header: ["state", "jobs", "cpu_hours"],
        rows: states.map((s) => [s.state, s.jobs, s.cpuHours]),
      })}
    >
      <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5">
        {states.map((s) => (
          <div
            key={s.state}
            className={stateDotClass(s.state)}
            style={{ flex: s.jobs }}
            title={`${stateLabel(s.state)}: ${fmtInt(s.jobs)}`}
          />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {states.map((s) => (
          <div key={s.state} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-sm ${stateDotClass(s.state)}`} />
            <span className="flex-1 truncate">{stateLabel(s.state)}</span>
            <span className="text-muted-foreground tabular-nums">{fmtInt(s.jobs)}</span>
            <span className="text-muted-foreground tabular-nums w-12 text-right">{fmtPct(total ? s.jobs / total : null, 1)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PreemptionRows({ rows }: { rows: OverviewData["preemption"]["nodes"] }) {
  const max = Math.max(...rows.map((r) => r.preempted), 0);
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[7rem_minmax(0,1fr)_4rem_4rem_4rem] gap-3 text-[11px] uppercase tracking-wide text-muted-foreground pb-1.5">
        <span>Node</span>
        <span />
        <span className="text-right">Preempted</span>
        <span className="text-right">Jobs</span>
        <span className="text-right">Rate</span>
      </div>
      {rows.map((n) => (
        <div
          key={n.node}
          className="grid grid-cols-[7rem_minmax(0,1fr)_4rem_4rem_4rem] gap-3 items-center text-sm py-1.5 border-t tabular-nums"
        >
          <span className="font-mono text-xs truncate">{n.node}</span>
          <span className="h-2 rounded-full bg-muted overflow-hidden">
            <span className="block h-full rounded-full bg-[hsl(var(--chart-5))]" style={{ width: max ? `${(n.preempted / max) * 100}%` : 0 }} />
          </span>
          <span className="text-right">{fmtInt(n.preempted)}</span>
          <span className="text-right text-muted-foreground">{fmtInt(n.jobs)}</span>
          <span className="text-right text-muted-foreground">{fmtPct(n.jobs ? n.preempted / n.jobs : null, 1)}</span>
        </div>
      ))}
    </div>
  );
}

function GpuRows({ rows }: { rows: OverviewData["gpu"] }) {
  const max = Math.max(...rows.map((r) => r.gpuHours), 0);
  return (
    <div className="flex flex-col">
      {rows.map((g) => (
        <div
          key={g.partition}
          className="grid grid-cols-[6rem_minmax(0,1fr)_4rem_5rem] gap-3 items-center text-sm py-1.5 border-t tabular-nums"
        >
          <span className="font-mono text-xs truncate">{g.partition}</span>
          <span className="h-2 rounded-full bg-muted overflow-hidden">
            <span
              className="block h-full rounded-full bg-[hsl(var(--chart-4))]"
              style={{ width: max ? `${(g.gpuHours / max) * 100}%` : 0 }}
            />
          </span>
          <span className="text-right">{fmtNum(g.gpuHours)}</span>
          <span className="text-right text-muted-foreground">
            {g.utilization === null ? "—" : `${g.utilization.toFixed(0)}% util`}
          </span>
        </div>
      ))}
    </div>
  );
}
