"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeature, useHierarchyLabels, useRuntimeConfig } from "@/components/runtime-config";
import { cn } from "@/lib/utils";
import type { JobsData } from "@/lib/metrics/load";
import type { JobDetail, JobRow } from "@/lib/metrics/jobs";
import { getTerm, setTerm } from "@/lib/metrics/job-query";
import { expandHostlist } from "@/lib/metrics/hostlist";
import { useMetricsNav } from "@/components/metrics/metrics-nav";
import { CsvButton, EmptyState, QuietNote } from "@/components/metrics/panel";
import { AskAssistantButton } from "@/components/assistant";
import { fmtBytes, fmtClock, fmtInt, fmtNum, fmtPct, stateDotClass, stateLabel } from "@/components/metrics/format";

const PAGE_SIZE = 50;

const STATES = ["completed", "failed", "timeout", "cancelled", "oom", "node_fail", "preempted"];

function useDateFormat() {
  const { metricsTimeZone } = useRuntimeConfig();
  return React.useMemo(() => {
    const f = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: metricsTimeZone,
    });
    return (iso: string | null) => (iso ? f.format(new Date(iso)) : "—");
  }, [metricsTimeZone]);
}

export function JobsTab({ data, totalCpu }: { data: JobsData; totalCpu: boolean }) {
  const { params, navigate, fromDate, toDate } = useMetricsNav();
  const { search, detail } = data;
  const q = params.jobs.q;
  const [text, setText] = React.useState(q);
  // Follow the URL when the search changes from elsewhere (chips, back button)
  const [shownQ, setShownQ] = React.useState(q);
  if (shownQ !== q) {
    setShownQ(q);
    setText(q);
  }
  const fmtDate = useDateFormat();

  const run = (nextQ: string, page = 1) => navigate((p) => ({ ...p, jobs: { ...p.jobs, q: nextQ.trim(), page } }));
  const select = (key: string) => navigate((p) => ({ ...p, jobs: { ...p.jobs, job: key } }));
  const pages = Math.max(1, Math.ceil(search.total / PAGE_SIZE));
  const page = Math.min(params.jobs.page, pages);
  const state = getTerm(q, "state");
  const gpu = getTerm(q, "gpu");
  const eff = getTerm(q, "eff");

  const chip = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-card text-[13px] text-foreground/90 hover:border-foreground/30",
      on && "border-foreground/40 bg-muted/50"
    );

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <section className="flex-[999_1_34rem] min-w-0 flex flex-col gap-3" aria-label="Job search">
        <form
          className="flex items-center gap-2.5 h-11 px-3.5 rounded-xl border bg-card focus-within:ring-1 focus-within:ring-ring"
          onSubmit={(e) => {
            e.preventDefault();
            run(text);
          }}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <label htmlFor="metrics-job-search" className="sr-only">
            Search jobs
          </label>
          <input
            id="metrics-job-search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Job ID, name, or user: account: partition: node: state: date:2026-10-01 eff<25"
            className="flex-1 min-w-0 bg-transparent outline-none font-mono text-sm placeholder:text-muted-foreground/70"
          />
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => run("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {fmtInt(search.total)}
            {search.truncated ? "+" : ""} jobs
          </span>
        </form>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            aria-label="State"
            value={state ?? ""}
            onChange={(e) => run(setTerm(q, "state", e.target.value || null))}
            className={cn(chip(Boolean(state)), "pr-2 appearance-auto")}
          >
            <option value="">State: any</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                State: {s === "oom" ? "out of memory" : s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={chip(gpu !== null && gpu !== "no")}
            onClick={() => run(setTerm(q, "gpu", gpu === "yes" ? null : "yes"))}
          >
            Has GPUs
          </button>
          {totalCpu && (
            <button type="button" className={chip(eff !== null)} onClick={() => run(setTerm(q, "eff", eff ? null : "25"))}>
              CPU efficiency below 25%
            </button>
          )}
          <div className="flex-1" />
          <CsvButton
            label="CSV (this page)"
            csv={() => ({
              filename: `jobs_${fromDate}_${toDate}`,
              header: [
                "job_id",
                "cluster",
                "name",
                "state",
                "user",
                "account",
                "partition",
                "end_time",
                "cpu_hours",
                "gpus",
                "cpu_efficiency",
                "nodes",
              ],
              rows: search.jobs.map((j) => [
                j.jobId,
                j.cluster,
                j.name,
                j.state,
                j.user,
                j.account,
                j.partition,
                j.endTime,
                j.cpuHours,
                j.gpuCount,
                j.cpuEfficiency,
                j.nodeList,
              ]),
            })}
          />
        </div>

        {search.ignored.length > 0 && (
          <QuietNote>{search.ignored.join(", ")} ignored: CPU efficiency needs slurm-history-ingestor 1.1.</QuietNote>
        )}
        {search.allDates && <QuietNote>Job ID searches cover every date, not just the selected range.</QuietNote>}

        {search.jobs.length === 0 ? (
          <EmptyState>No jobs match.</EmptyState>
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left font-normal py-2.5 pl-3.5">Job</th>
                  <th className="text-left font-normal py-2.5 px-2">Name</th>
                  <th className="text-left font-normal py-2.5 px-2">State</th>
                  <th className="text-left font-normal py-2.5 px-2">User</th>
                  <th className="text-left font-normal py-2.5 px-2">Ended</th>
                  <th className="text-right font-normal py-2.5 px-2">CPU h</th>
                  <th className="text-right font-normal py-2.5 pl-2 pr-3.5">CPU eff</th>
                </tr>
              </thead>
              <tbody>
                {search.jobs.map((j) => (
                  <JobRowView
                    key={`${j.cluster}:${j.key}`}
                    job={j}
                    selected={detail?.key === j.key}
                    onSelect={select}
                    fmtDate={fmtDate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {fmtInt(pages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => run(q, page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= pages}
              onClick={() => run(q, page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>

      <aside
        className="flex-[1_1_26rem] min-w-0 rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-4"
        aria-label="Job details"
      >
        {detail ? (
          <JobDetailView job={detail} totalCpu={totalCpu} />
        ) : params.jobs.job ? (
          <p className="text-sm text-muted-foreground">Job {params.jobs.job} isn&apos;t in the job history.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a job to see what it asked for and what it used.</p>
        )}
      </aside>
    </div>
  );
}

function JobRowView({
  job,
  selected,
  onSelect,
  fmtDate,
}: {
  job: JobRow;
  selected: boolean;
  onSelect: (key: string) => void;
  fmtDate: (iso: string | null) => string;
}) {
  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(job.key)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(job.key);
        }
      }}
      className={cn(
        "border-t cursor-pointer hover:bg-muted/50 outline-none focus-visible:bg-muted/50",
        selected && "bg-muted/60 shadow-[inset_2px_0_0_hsl(var(--foreground))]"
      )}
    >
      <td className="py-2 pl-3.5 font-mono text-xs">{job.jobId}</td>
      <td className="py-2 px-2 max-w-[14rem] truncate">{job.name || "—"}</td>
      <td className="py-2 px-2 whitespace-nowrap text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", stateDotClass(job.state))} />
          {stateLabel(job.state)}
        </span>
      </td>
      <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{job.user ?? "—"}</td>
      <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(job.endTime)}</td>
      <td className="py-2 px-2 text-right">{fmtNum(job.cpuHours)}</td>
      <td className="py-2 pl-2 pr-3.5 text-right text-muted-foreground">{fmtPct(job.cpuEfficiency)}</td>
    </tr>
  );
}

function UsageRow({ label, ratio, value, color }: { label: string; ratio: number | null; value: string; color: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)_minmax(0,11rem)] gap-3 items-center text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="h-2 rounded-full bg-muted overflow-hidden">
        {ratio !== null && (
          <span className="block h-full" style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%`, background: color }} />
        )}
      </span>
      <span className="text-right tabular-nums truncate">{value}</span>
    </div>
  );
}

const cores = (n: number | null) => `${fmtInt(n)} ${n === 1 ? "core" : "cores"}`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

function JobDetailView({ job, totalCpu }: { job: JobDetail; totalCpu: boolean }) {
  const fmtDate = useDateFormat();
  const gpuHistory = useFeature("gpuHistory");
  const { level2 } = useHierarchyLabels();
  const wait = job.waitSeconds ?? 0;
  const run = job.runSeconds ?? 0;
  const limit = job.timeLimitMinutes ? job.timeLimitMinutes * 60 : null;
  const unused = limit !== null ? Math.max(0, limit - run) : 0;
  const reqMemBytes = job.reqMemMb !== null ? job.reqMemMb * 1048576 : null;
  const nodes = expandHostlist(job.nodeList, 200);

  const who = [
    job.user,
    job.account,
    job.department,
    job.partition && `partition ${job.partition}`,
    job.qos && `QoS ${job.qos}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="font-mono text-xl font-medium">{job.jobId}</h2>
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-muted text-xs">
            <span className={cn("h-1.5 w-1.5 rounded-full", stateDotClass(job.state))} />
            {stateLabel(job.state)}
          </span>
          {job.arrayJobId && job.arrayJobId !== job.jobId && (
            <span className="text-xs text-muted-foreground font-mono">
              array {job.arrayJobId}
              {job.arrayTaskId !== null ? `_${job.arrayTaskId}` : ""}
            </span>
          )}
          <AskAssistantButton
            className="ml-auto"
            question={`Tell me about job ${job.jobId}: how it ended and why, how well it used what it asked for, and what to change next time.`}
          />
        </div>
        {job.name && <span className="text-sm">{job.name}</span>}
        <span className="text-xs text-muted-foreground" title={job.department ? `${level2}: ${job.department}` : undefined}>
          {who.join(" · ")}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5" aria-hidden>
          <div className="bg-muted-foreground/50" style={{ flex: Math.max(wait, 1) }} title={`Waited ${fmtClock(wait)}`} />
          <div className="bg-[hsl(var(--chart-1))]" style={{ flex: Math.max(run, 1) }} title={`Ran ${fmtClock(run)}`} />
          {unused > 0 && <div className="bg-muted" style={{ flex: unused }} title={`${fmtClock(unused)} of the limit unused`} />}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <span>
            <span className="text-muted-foreground">Submitted</span>
            <br />
            {fmtDate(job.submitTime)}
          </span>
          <span>
            <span className="text-muted-foreground">Started after {fmtClock(wait)}</span>
            <br />
            {fmtDate(job.startTime)}
          </span>
          <span>
            <span className="text-muted-foreground">
              Ran {fmtClock(run)}
              {limit !== null && ` of ${fmtClock(limit)}`}
            </span>
            <br />
            {fmtDate(job.endTime)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-semibold">Requested vs used</span>
        <UsageRow
          label="CPU"
          ratio={job.cpuEfficiency}
          color="hsl(var(--chart-1))"
          value={
            !totalCpu
              ? "needs ingestor 1.1"
              : job.cpuEfficiency === null
                ? `${cores(job.reqCpus)}, not measured`
                : `${fmtPct(job.cpuEfficiency)} of ${cores(job.reqCpus)}`
          }
        />
        <UsageRow
          label="Memory"
          ratio={job.maxRssBytes !== null && reqMemBytes ? job.maxRssBytes / reqMemBytes : null}
          color="hsl(var(--chart-3))"
          value={
            job.maxRssBytes !== null
              ? `${fmtBytes(job.maxRssBytes)} of ${fmtBytes(reqMemBytes)}`
              : reqMemBytes
                ? `${fmtBytes(reqMemBytes)} requested`
                : "—"
          }
        />
        <UsageRow
          label="Time"
          ratio={limit ? run / limit : null}
          color="hsl(var(--chart-3))"
          value={limit ? `${fmtClock(run)} of ${fmtClock(limit)}` : fmtClock(run)}
        />
        {job.gpuCount > 0 && (
          <UsageRow
            label="GPU"
            ratio={job.gpu ? job.gpu.avgUtilization / 100 : null}
            color="hsl(var(--chart-4))"
            value={
              job.gpu
                ? `${job.gpu.avgUtilization.toFixed(0)}% avg on ${job.gpuCount} GPU${job.gpuCount === 1 ? "" : "s"}`
                : gpuHistory
                  ? `${job.gpuCount} GPU${job.gpuCount === 1 ? "" : "s"}, not measured`
                  : `${job.gpuCount} GPU${job.gpuCount === 1 ? "" : "s"}`
            }
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label={nodes.length === 1 ? "Node" : `Nodes (${nodes.length})`}>
          {nodes.length === 0 ? (
            "—"
          ) : (
            <span className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-xs">
              {nodes.slice(0, 12).map((n) => (
                <Link
                  key={n}
                  href={`/?node=${encodeURIComponent(n)}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {n}
                </Link>
              ))}
              {nodes.length > 12 && <span className="text-muted-foreground">+{nodes.length - 12} more</span>}
            </span>
          )}
        </Field>
        <Field label="Exit code">
          <span className="font-mono">{job.exitCode ?? "—"}</span>
          {job.exitState && <span className="text-muted-foreground"> · {job.exitState.toLowerCase().replace(/_/g, " ")}</span>}
        </Field>
        <Field label="Allocated">
          <span className="font-mono text-xs">{job.tresAlloc ? job.tresAlloc.split(",").join(", ") : "—"}</span>
        </Field>
        <Field label="CPU hours · GPU hours">
          {fmtNum(job.cpuHours)} · {fmtNum(job.gpuHours)}
        </Field>
        <Field label="Cluster">{job.cluster}</Field>
        {totalCpu && job.totalCpuSeconds !== null && <Field label="CPU time used">{fmtClock(job.totalCpuSeconds)}</Field>}
      </div>
    </div>
  );
}
