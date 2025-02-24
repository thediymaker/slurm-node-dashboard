import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Server } from "lucide-react";

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
    nodeFetcher
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="text-gray-100">
          <CardHeader>
            <CardTitle className="text-gray-100">Cluster Capacities</CardTitle>
            <CardDescription className="text-gray-400">
              Overview of current cluster resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : error ? (
              <Alert
                variant="destructive"
                className="bg-red-900 text-red-100 border-red-700"
              >
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Failed to load cluster data.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Cluster Status</AlertTitle>
                  <AlertDescription>
                    Cluster resource information is available.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredClusterData.map((item, index) => (
                    <motion.div
                      key={item.type}
                      className="p-4 rounded-lg shadow-md border bg-zinc-900"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <Server className="h-4 w-4" />
                        <h3 className="text-sm font-semibold text-gray-300 uppercase">
                          {item.type} {item.name}
                        </h3>
                      </div>
                      <p className="text-2xl font-bold">
                        {item.count.toLocaleString()}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClusterStats;
