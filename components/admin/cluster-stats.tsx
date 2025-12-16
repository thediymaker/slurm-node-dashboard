"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface ClusterData {
  type: string;
  count: number;
  name: string;
}

interface ClusterResponse {
  clusters: Array<{
    tres: ClusterData[];
  }>;
}

const nodeURL = "/api/slurm/cluster";
const nodeFetcher = async (): Promise<ClusterResponse> => {
  const res = await fetch(nodeURL, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

const ClusterStats: React.FC = () => {
  const { data, error, isLoading } = useSWR<ClusterResponse>(
    nodeURL,
    nodeFetcher,
    { refreshInterval: 15000 }
  );
  const [clusterData, setClusterData] = useState<ClusterData[]>([]);

  useEffect(() => {
    if (data && data.clusters && data.clusters[0]) {
      setClusterData(data.clusters[0].tres);
    }
  }, [data]);

  const filteredClusterData = useMemo(() => {
    return clusterData.filter((item) => item.count > 0);
  }, [clusterData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Cluster Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Cluster Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load cluster data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-medium">Cluster Resources (TRES)</CardTitle>
      </CardHeader>
      <CardContent>
        {filteredClusterData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resource data available</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredClusterData.map((item) => (
              <div
                key={`${item.type}-${item.name}`}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-xs uppercase">
                    {item.type}
                  </Badge>
                </div>
                <div className="text-2xl font-bold">
                  {item.count.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {item.name || item.type}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClusterStats;
