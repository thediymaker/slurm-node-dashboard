"use client";

import useSWR from "swr";
import { withBasePath } from "@/lib/base-path";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PreemptionResponse {
  enabled: boolean;
  days?: number;
  jobs?: number;
  preempted?: number;
}

// One line under the node history; nothing unless a job here was preempted
export function NodePreemption({ nodeName }: { nodeName: string }) {
  const { data } = useSWR<PreemptionResponse>(
    withBasePath(`/api/node-history/preemption?node=${encodeURIComponent(nodeName)}`),
    fetcher
  );
  if (!data?.enabled || !data.preempted || !data.jobs) return null;
  const rate = (data.preempted / data.jobs) * 100;
  return (
    <p className="text-xs text-muted-foreground">
      Preempted <span className="text-foreground tabular-nums">{data.preempted.toLocaleString()}</span> of{" "}
      <span className="tabular-nums">{data.jobs.toLocaleString()}</span> jobs ({rate < 1 ? rate.toFixed(1) : Math.round(rate)}%) in the last {data.days} days
    </p>
  );
}
