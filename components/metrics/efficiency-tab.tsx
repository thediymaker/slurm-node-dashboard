"use client";

import { cn } from "@/lib/utils";
import { useFeature } from "@/components/runtime-config";
import type { EfficiencyData } from "@/lib/metrics/load";
import { useMetricsNav } from "@/components/metrics/metrics-nav";
import { EmptyState, KpiTile, Panel, QuietNote } from "@/components/metrics/panel";
import { ColumnHistogram } from "@/components/metrics/charts";
import { fmtInt, fmtNum, fmtPct } from "@/components/metrics/format";

const NEEDS_INGESTOR = "needs slurm-history-ingestor 1.1";
const BIN_LABELS = Array.from({ length: 10 }, (_, i) => `${i * 10}–${i * 10 + 10}%`);

// Below `bad` is flagged strongly, below `warn` lightly
function tone(ratio: number | null, warn: number, bad: number) {
  if (ratio === null) return "text-muted-foreground";
  if (ratio < bad) return "text-orange-600 dark:text-orange-400";
  if (ratio < warn) return "text-amber-600 dark:text-amber-300";
  return "";
}

// A short hint at the user's biggest waste
function pattern(u: EfficiencyData["users"][number]): string {
  const issues: [number, string][] = [];
  if (u.cpu !== null && u.cpu < 0.5) issues.push([u.cpu, `uses ${fmtPct(u.cpu)} of allocated cores`]);
  if (u.memory !== null && u.memory < 0.3) issues.push([u.memory, `peaks at ${fmtPct(u.memory)} of requested memory`]);
  if (u.wallTime !== null && u.wallTime < 0.25) issues.push([u.wallTime, `runs ${fmtPct(u.wallTime)} of the time limit`]);
  if (u.gpu !== null && u.gpu < 0.3) issues.push([u.gpu, `GPUs ${fmtPct(u.gpu)} busy`]);
  issues.sort((a, b) => a[0] - b[0]);
  return issues.length
    ? issues
        .slice(0, 2)
        .map((i) => i[1])
        .join("; ")
    : "—";
}

export function EfficiencyTab({ data, totalCpu }: { data: EfficiencyData; totalCpu: boolean }) {
  const { fromDate, toDate } = useMetricsNav();
  const gpuHistory = useFeature("gpuHistory");
  const { kpis, histograms, users } = data;
  const range = `${fromDate}_${toDate}`;

  if (kpis.jobs === 0) return <EmptyState>No jobs ended in this range with these filters.</EmptyState>;

  const share = (bins: number[], upTo: number) => {
    const total = bins.reduce((a, b) => a + b, 0);
    return total > 0 ? bins.slice(0, upTo).reduce((a, b) => a + b, 0) / total : null;
  };
  const cpuLow = share(histograms.cpu, 3);
  const memLow = share(histograms.memory, 3);
  const gpuLow = share(histograms.gpu, 2);
  const hasGpu = histograms.gpu.some((v) => v > 0);
  const hasMem = histograms.memory.some((v) => v > 0);
  const notes: string[] = [];
  if (!totalCpu)
    notes.push(`The CPU efficiency histogram is hidden: CPU efficiency ${NEEDS_INGESTOR}, which records the CPU time jobs used.`);
  if (!hasMem)
    notes.push(
      "The memory histogram is hidden because no jobs in this range have both peak memory and a memory request recorded."
    );
  if (!gpuHistory) notes.push("GPU utilization needs GPU history (Admin → Plugins).");
  else if (!hasGpu) notes.push("The GPU histogram is hidden because no GPU jobs in this range have utilization recorded.");

  return (
    <>
      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label="CPU efficiency"
          value={
            totalCpu ? (
              fmtPct(kpis.cpu)
            ) : (
              <span className="block text-sm font-normal text-muted-foreground whitespace-normal">{NEEDS_INGESTOR}</span>
            )
          }
          sub="CPU time used ÷ allocated"
        />
        <KpiTile label="Memory efficiency" value={fmtPct(kpis.memory)} sub="peak RSS ÷ requested" />
        <KpiTile label="Wall time used" value={fmtPct(kpis.wallTime)} sub="run time ÷ time limit" />
        <KpiTile
          label="GPU utilization"
          value={gpuHistory ? fmtPct(kpis.gpu) : "—"}
          sub={gpuHistory ? "while allocated" : "needs GPU history"}
        />
        <KpiTile
          label="Lost to failures"
          value={fmtPct(kpis.failedShare)}
          sub={`${fmtNum(kpis.failedCpuHours)} CPU h failed or timed out`}
          title="CPU hours in jobs that failed, timed out, ran out of memory or lost their node"
        />
        <KpiTile label="Short jobs" value={fmtPct(kpis.shortShare)} sub={`${fmtInt(kpis.shortJobs)} jobs ran under 1 minute`} />
      </div>
      <QuietNote>
        Jobs shorter than 1 minute are left out of the efficiency figures. Covers jobs that ended in the range.
      </QuietNote>

      <div className="grid gap-4 lg:grid-cols-3">
        {totalCpu && (
          <Panel
            title="CPU efficiency"
            alignBottom
            description="CPU hours by how much of the allocation was used"
            csv={() => ({
              filename: `cpu-efficiency_${range}`,
              header: ["efficiency", "cpu_hours"],
              rows: BIN_LABELS.map((l, i) => [l, histograms.cpu[i] ?? 0]),
            })}
          >
            <ColumnHistogram
              color="hsl(var(--chart-1))"
              showValues={false}
              bins={BIN_LABELS.map((l, i) => ({
                label: `${i * 10}%`,
                value: histograms.cpu[i] ?? 0,
                display: fmtNum(histograms.cpu[i] ?? 0),
                title: `${l}: ${fmtNum(histograms.cpu[i] ?? 0)} CPU hours`,
              }))}
            />
            {cpuLow !== null && (
              <span className="text-xs text-muted-foreground">
                {fmtPct(cpuLow)} of CPU hours went to jobs using under 30% of their cores.
              </span>
            )}
          </Panel>
        )}
        {hasMem && (
          <Panel
            title="Memory used vs requested"
            alignBottom
            description="jobs by peak memory as a share of the request"
            csv={() => ({
              filename: `memory-efficiency_${range}`,
              header: ["peak_of_request", "jobs"],
              rows: BIN_LABELS.map((l, i) => [l, histograms.memory[i] ?? 0]),
            })}
          >
            <ColumnHistogram
              color="hsl(var(--chart-3))"
              showValues={false}
              bins={BIN_LABELS.map((l, i) => ({
                label: `${i * 10}%`,
                value: histograms.memory[i] ?? 0,
                display: fmtInt(histograms.memory[i] ?? 0),
                title: `${l}: ${fmtInt(histograms.memory[i] ?? 0)} jobs`,
              }))}
            />
            {memLow !== null && (
              <span className="text-xs text-muted-foreground">
                {fmtPct(memLow)} of jobs peaked under 30% of the memory they asked for.
              </span>
            )}
          </Panel>
        )}
        {gpuHistory && hasGpu && (
          <Panel
            title="GPU utilization"
            alignBottom
            description="GPU hours by average utilization"
            csv={() => ({
              filename: `gpu-utilization_${range}`,
              header: ["utilization", "gpu_hours"],
              rows: BIN_LABELS.map((l, i) => [l, histograms.gpu[i] ?? 0]),
            })}
          >
            <ColumnHistogram
              color="hsl(var(--chart-4))"
              showValues={false}
              bins={BIN_LABELS.map((l, i) => ({
                label: `${i * 10}%`,
                value: histograms.gpu[i] ?? 0,
                display: fmtNum(histograms.gpu[i] ?? 0),
                title: `${l}: ${fmtNum(histograms.gpu[i] ?? 0)} GPU hours`,
              }))}
            />
            {gpuLow !== null && (
              <span className="text-xs text-muted-foreground">{fmtPct(gpuLow)} of GPU hours ran below 20% utilization.</span>
            )}
          </Panel>
        )}
      </div>

      <Panel
        title={totalCpu ? "Most unused allocation" : "Largest users"}
        description={
          totalCpu
            ? "users ranked by allocated CPU hours their jobs didn't use"
            : "by CPU hours; ranking by unused CPU hours " + NEEDS_INGESTOR
        }
        csv={() => ({
          filename: `user-efficiency_${range}`,
          header: [
            "user",
            "account",
            "jobs",
            "cpu_hours",
            "unused_cpu_hours",
            "cpu_efficiency",
            "memory_efficiency",
            "wall_time_used",
            "gpu_utilization",
          ],
          rows: users.map((u) => [u.user, u.account, u.jobs, u.cpuHours, u.unusedCpuHours, u.cpu, u.memory, u.wallTime, u.gpu]),
        })}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-normal pb-1.5">User</th>
                <th className="text-left font-normal pb-1.5">Account</th>
                <th className="text-right font-normal pb-1.5">CPU h</th>
                {totalCpu && <th className="text-right font-normal pb-1.5">Unused</th>}
                <th className="text-right font-normal pb-1.5">CPU</th>
                <th className="text-right font-normal pb-1.5">Memory</th>
                <th className="text-right font-normal pb-1.5">Wall</th>
                <th className="text-right font-normal pb-1.5">GPU</th>
                <th className="text-left font-normal pb-1.5 pl-4">Pattern</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user} className="border-t">
                  <td className="py-1.5 pr-2 font-mono text-xs">{u.user}</td>
                  <td className="py-1.5 pr-2 font-mono text-xs text-muted-foreground max-w-[10rem] truncate">
                    {u.account ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">{fmtNum(u.cpuHours)}</td>
                  {totalCpu && <td className="py-1.5 text-right">{fmtNum(u.unusedCpuHours)}</td>}
                  <td className={cn("py-1.5 text-right", tone(u.cpu, 0.5, 0.25))}>{fmtPct(u.cpu)}</td>
                  <td className={cn("py-1.5 text-right", tone(u.memory, 0.3, 0.15))}>{fmtPct(u.memory)}</td>
                  <td className={cn("py-1.5 text-right", tone(u.wallTime, 0.3, 0.15))}>{fmtPct(u.wallTime)}</td>
                  <td className={cn("py-1.5 text-right", tone(u.gpu, 0.5, 0.25))}>{fmtPct(u.gpu)}</td>
                  <td className="py-1.5 pl-4 text-muted-foreground max-w-[22rem] truncate">{pattern(u)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {notes.map((n) => (
        <QuietNote key={n}>{n}</QuietNote>
      ))}
    </>
  );
}
