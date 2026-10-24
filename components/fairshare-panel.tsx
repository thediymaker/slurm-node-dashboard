"use client";

import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import { useFeature } from "@/components/runtime-config";
import { withBasePath } from "@/lib/base-path";
import type { FairshareAccount, FairshareResult } from "@/lib/fairshare";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`);

// LevelFS compares an association's share with its usage among its siblings:
// above 1 it has used less than its share, below 1 more
function levelText(level: FairshareAccount["levelFs"]): { value: string; note: string } {
  if (level === "inf") return { value: "∞", note: "no usage" };
  if (level === null) return { value: "—", note: "" };
  return {
    value: level >= 10 ? level.toFixed(0) : level.toFixed(2),
    note: level > 1.05 ? "under its share" : level < 0.95 ? "over its share" : "at its share",
  };
}

function Level({ label, level }: { label: string; level: FairshareAccount["levelFs"] }) {
  const { value, note } = levelText(level);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
      {note && <span className="text-muted-foreground">{note}</span>}
    </span>
  );
}

function AccountRow({ user, row }: { user: string; row: FairshareAccount }) {
  const factor = row.factor ?? 0;
  return (
    <div className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm">{row.account}</span>
        {row.partition && <span className="text-xs text-muted-foreground">partition {row.partition}</span>}
        <span className="ml-auto text-xs text-muted-foreground">FairShare</span>
        <span className="text-lg font-semibold tabular-nums leading-none">{row.factor === null ? "—" : factor.toFixed(3)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden" title="FairShare factor, 0 to 1">
        <div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${Math.min(1, factor) * 100}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">
        {user} has {pct(row.normShares)} of {row.account}&apos;s shares and used {pct(row.effectiveUsage)} of its
        recent usage
      </div>
      {row.path.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {row.path.map((p, i) => (
            <span key={p.account} className="inline-flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <Level label={p.account} level={p.levelFs} />
            </span>
          ))}
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Level label={user} level={row.levelFs} />
        </div>
      )}
    </div>
  );
}

// The user's FairShare factor in each account, and the LevelFS at each step
// up the tree, which is what decides it. Hidden when Slurm has none.
export function FairsharePanel({ user }: { user: string }) {
  const enabled = useFeature("fairshare");
  const { data } = useSWR<FairshareResult>(
    enabled && user ? withBasePath(`/api/slurm/fairshare/${encodeURIComponent(user)}`) : null,
    fetcher
  );
  if (!data?.available || data.accounts.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Fair share</h2>
        <span className="text-xs text-muted-foreground">
          LevelFS above 1: used less than its share among its siblings
        </span>
      </div>
      {data.accounts.map((row) => (
        <AccountRow key={`${row.account}/${row.partition}`} user={data.user} row={row} />
      ))}
    </section>
  );
}
