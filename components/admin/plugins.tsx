"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DatabaseStatus, FeatureState, Features } from "@/lib/features";

const DESCRIPTIONS: Record<FeatureState["id"], string> = {
  modules: "Browse and search the cluster's software modules",
  prometheus: "Per-node CPU, memory and power charts",
  gpu: "Live GPU utilization for running jobs and the GPU Analysis tab",
  ai: "AI assistant for cluster questions",
  rewind: "Replay the cluster's state at an earlier time",
  nodeHistory: "When nodes were drained or down, and why",
  gpuHistory: "GPU utilization of finished jobs",
  jobMetrics: "Job statistics and analytics from the history ingestor",
};

const FeatureItem = ({ feature }: { feature: FeatureState }) => (
  <div className="flex items-start justify-between gap-4 p-3 rounded-md border">
    <div className="min-w-0">
      <div className="font-medium text-sm">{feature.name}</div>
      <div className="text-xs text-muted-foreground">{DESCRIPTIONS[feature.id]}</div>
      <div className="text-xs mt-1 break-words">{feature.reason}</div>
      {feature.flag && (
        <code className="text-[10px] text-muted-foreground/70 font-mono mt-1 block">{feature.flag}</code>
      )}
    </div>
    <Badge variant={feature.enabled ? "default" : "secondary"} className="shrink-0">
      {feature.enabled ? "On" : "Off"}
    </Badge>
  </div>
);

function databaseSummary(db: DatabaseStatus): { label: string; detail: string; ok: boolean } {
  if (!db.configured) return { label: "Not configured", detail: "Set DATABASE_URL to a PostgreSQL database to turn on the features below.", ok: false };
  if (!db.reachable) return { label: "Unreachable", detail: db.error ?? "Unknown error", ok: false };
  if (db.schema === "failed")
    return { label: "Connected, tables missing", detail: `Couldn't create the dashboard's tables: ${db.schemaError}`, ok: false };
  const tables = [
    db.tables.jobHistory && "job history (ingestor)",
    db.tables.gpuMetrics && "GPU metrics",
    db.tables.nodeEvents && db.tables.nodeStateTime && "node history",
    db.tables.nodeSnapshots && "node snapshots",
  ].filter(Boolean);
  return { label: "Connected", detail: `Tables: ${tables.join(", ") || "none"}.`, ok: true };
}

const AdminPlugins = ({ features, database }: { features: Features; database: DatabaseStatus }) => {
  const all = Object.values(features);
  const withoutDb = all.filter((f) => !f.needsDatabase);
  const withDb = all.filter((f) => f.needsDatabase);
  const db = databaseSummary(database);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Features</CardTitle>
          <CardDescription>
            {all.filter((f) => f.enabled).length} of {all.length} optional features on. A feature turns on when what it
            needs is configured; set its flag to false to turn it off.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Without a database</CardTitle>
          <CardDescription>Need only Slurm, plus the service each one names</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {withoutDb.map((f) => (
            <FeatureItem key={f.id} feature={f} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium">With a database</CardTitle>
            <Badge variant={db.ok ? "default" : "secondary"}>{db.label}</Badge>
          </div>
          <CardDescription className="break-words">{db.detail}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {withDb.map((f) => (
            <FeatureItem key={f.id} feature={f} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlugins;
