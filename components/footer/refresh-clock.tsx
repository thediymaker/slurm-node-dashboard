"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// When the page's live data last arrived and how often it refreshes, so the
// footer can count down to the next refresh. Pages that poll call
// markRefreshed on each success and clearRefresh when they unmount.
type Clock = { at: number; intervalMs: number } | null;
let clock: Clock = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function markRefreshed(intervalMs: number) {
  clock = { at: Date.now(), intervalMs };
  emit();
}

export function clearRefresh() {
  clock = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function RefreshCountdown({ stale }: { stale?: boolean }) {
  const current = useSyncExternalStore(subscribe, () => clock, () => null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!current) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [current]);

  if (!current) return null;
  const left = Math.max(0, current.at + current.intervalMs - now);
  const seconds = Math.ceil(left / 1000);
  // Overdue by more than one more interval: the last refresh failed
  const late = stale || now - current.at > current.intervalMs * 2;

  return (
    <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex" aria-live="off">
      <span className={cn("tabular-nums", late && "text-destructive")}>
        {late ? "Not refreshing" : seconds > 0 ? `Refresh in ${seconds}s` : "Refreshing…"}
      </span>
      <span className="h-[3px] w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-1000 ease-linear", late ? "bg-destructive" : "bg-foreground/70")}
          style={{ width: late ? "100%" : `${(left / current.intervalMs) * 100}%` }}
        />
      </span>
    </div>
  );
}
