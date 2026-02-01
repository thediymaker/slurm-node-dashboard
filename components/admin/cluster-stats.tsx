"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAdminCluster, useAdminDiag } from "./admin-utils";

interface ClusterData {
  type: string;
  count: number;
  name: string;
}

// Format large numbers with appropriate units
function formatResourceCount(count: number, type: string): string {
  const lowerType = type.toLowerCase();
  
  // Memory is typically in MB, convert to more readable format
  if (lowerType === "mem" || lowerType === "memory") {
    if (count >= 1024 * 1024) {
      return `${(count / (1024 * 1024)).toFixed(1)} TB`;
    }
    if (count >= 1024) {
      return `${(count / 1024).toFixed(1)} GB`;
    }
    return `${count} MB`;
  }
  
  // Format large numbers with K/M suffix
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  
  return count.toLocaleString();
}

const ClusterStats: React.FC = () => {
  const { data: clusterData, isLoading: clusterLoading, error: clusterError } = useAdminCluster();
  const { data: diagData, isLoading: diagLoading } = useAdminDiag();

  const isLoading = clusterLoading || diagLoading;

  // Extract TRES data from cluster response
  const tresData = useMemo<ClusterData[]>(() => {
    if (!clusterData?.clusters?.[0]?.tres) return [];
    return clusterData.clusters[0].tres.filter((item: ClusterData) => item.count > 0);
  }, [clusterData]);

  // Extract scheduler statistics
  const schedulerStats = useMemo(() => {
    if (!diagData?.statistics) return null;
    const stats = diagData.statistics;
    return {
      serverThreads: stats.server_thread_count ?? 0,
      agentCount: stats.agent_count ?? 0,
      scheduleCycleMax: stats.schedule_cycle_max ?? 0,
      scheduleCycleMean: stats.schedule_cycle_mean ?? 0,
      scheduleCycleLast: stats.schedule_cycle_last ?? 0,
      bfActive: stats.bf_active ?? false,
      bfCycleCounter: stats.bf_cycle_counter ?? 0,
      dbdAgentCount: stats.dbd_agent_queue_size ?? 0,
    };
  }, [diagData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Cluster Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clusterError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Cluster Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load cluster data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* TRES Resources - Compact Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Cluster Resources (TRES)</CardTitle>
          <CardDescription>
            Trackable resources available across the cluster
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tresData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resource data available</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {tresData.map((item) => (
                <div
                  key={`${item.type}-${item.name}`}
                  className="p-3 rounded-md border bg-muted/30"
                >
                  <Badge variant="outline" className="text-[10px] uppercase font-mono mb-1.5">
                    {item.type}
                  </Badge>
                  <div className="text-lg font-semibold">
                    {formatResourceCount(item.count, item.type)}
                  </div>
                  <p className="text-[11px] text-muted-foreground capitalize truncate" title={item.name || item.type}>
                    {item.name || item.type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler Statistics - Compact */}
      {schedulerStats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Scheduler Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <StatItem label="Server Threads" value={schedulerStats.serverThreads} />
              <StatItem label="Agent Count" value={schedulerStats.agentCount} />
              <StatItem label="Cycle (Last)" value={`${schedulerStats.scheduleCycleLast.toLocaleString()} µs`} />
              <StatItem label="Cycle (Mean)" value={`${schedulerStats.scheduleCycleMean.toLocaleString()} µs`} />
              <StatItem label="Cycle (Max)" value={`${schedulerStats.scheduleCycleMax.toLocaleString()} µs`} />
              <StatItem label="Backfill" value={schedulerStats.bfActive ? "Active" : "Inactive"} />
              <StatItem label="BF Cycles" value={schedulerStats.bfCycleCounter.toLocaleString()} />
              <StatItem label="DBD Queue" value={schedulerStats.dbdAgentCount} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-md border bg-muted/30">
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default ClusterStats;
