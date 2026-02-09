"use client";
import React, { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NodeCard } from "@/components/nodeCard/node-card";
import { RingLoader } from "react-spinners";
import { DateTimePicker } from "@/components/date-time";
import { HistoricalNode } from "@/types/types";

interface NodeStats {
  total: number;
  cpu: number;
  gpu: number;
  idle: number;
  allocated: number;
  down: number;
}

const fetcher = async (url: string): Promise<{ nodes: HistoricalNode[] }> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(
      errorData.message || "An error occurred while fetching the data."
    );
  }
  return res.json();
};

const DashboardHistory = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(
    undefined
  );
  const [isMounted, setIsMounted] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setSelectedDate(now);
    setSelectedTime(format(now, "HH:00"));
  }, []);

  const { data: historicalData, error, isValidating } = useSWR(
    isMounted && selectedDate && selectedTime
      ? `/api/rewind?date=${format(
          selectedDate,
          "yyyy-MM-dd"
        )}&time=${selectedTime}`
      : null,
    fetcher
  );

  const systems: HistoricalNode[] = historicalData?.nodes || [];

  // Single-pass calculation for all node statistics
  const nodeStats: NodeStats = useMemo(() => {
    const stats: NodeStats = {
      total: 0,
      cpu: 0,
      gpu: 0,
      idle: 0,
      allocated: 0,
      down: 0,
    };

    for (const node of systems) {
      stats.total++;
      if (node.gres) stats.gpu++;
      else stats.cpu++;

      const state = node.state?.[0] || "";
      if (state === "IDLE") stats.idle++;
      else if (state === "ALLOCATED") stats.allocated++;
      else if (state === "DOWN") stats.down++;
    }

    return stats;
  }, [systems]);

  const handleRetry = () => {
    setRetrying(true);
    // SWR will automatically retry the fetch
    setTimeout(() => setRetrying(false), 1000);
  };

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <RingLoader color="white" size={64} />
      </div>
    );
  }

  return (
    <div className="py-6 w-[90%] mx-auto" role="main" aria-label="Historical Dashboard">
      <div className="mb-6">
        <DateTimePicker
          date={selectedDate}
          setDate={setSelectedDate}
          time={selectedTime}
          setTime={setSelectedTime}
        />
      </div>
      {error && (
        <div className="text-red-500 mb-4 p-4 bg-red-500/10 rounded-lg border border-red-500/20" role="alert" aria-live="assertive">
          <p className="font-semibold">Error loading historical data</p>
          <p className="text-sm mt-1">{error.message}</p>
          <button
            onClick={handleRetry}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
            disabled={retrying}
          >
            {retrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
      {isValidating && !historicalData && (
        <div className="flex justify-center items-center py-12">
          <RingLoader color="white" size={48} />
        </div>
      )}
      {historicalData && (
        <Card>
          <CardHeader>
            <CardTitle>
              Historical Data:{" "}
              {selectedDate && format(selectedDate, "yyyy-MM-dd")} at{" "}
              {selectedTime}
              <div className="text-sm mt-2" role="status" aria-label="Node statistics">
                <div className="flex flex-wrap justify-start gap-4">
                  <div className="flex items-center gap-2 font-extralight" title="GPU Nodes">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" aria-hidden="true"></span>
                    GPU Nodes
                    <span className="text-blue-400 font-medium" aria-label={`GPU Nodes: ${nodeStats.gpu}`}>
                      {nodeStats.gpu}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-extralight" title="CPU Nodes">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" aria-hidden="true"></span>
                    CPU Nodes
                    <span className="text-blue-400 font-medium" aria-label={`CPU Nodes: ${nodeStats.cpu}`}>
                      {nodeStats.cpu}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-extralight" title="IDLE Nodes">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" aria-hidden="true"></span>
                    IDLE Nodes
                    <span className="text-blue-400 font-medium" aria-label={`IDLE Nodes: ${nodeStats.idle}`}>
                      {nodeStats.idle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-extralight" title="DOWN Nodes">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" aria-hidden="true"></span>
                    DOWN Nodes
                    <span className="text-blue-400 font-medium" aria-label={`DOWN Nodes: ${nodeStats.down}`}>
                      {nodeStats.down}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-extralight" title="ALLOCATED Nodes">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" aria-hidden="true"></span>
                    ALLOCATED Nodes
                    <span className="text-blue-400 font-medium" aria-label={`ALLOCATED Nodes: ${nodeStats.allocated}`}>
                      {nodeStats.allocated}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-extralight" title="TOTAL Nodes">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" aria-hidden="true"></span>
                    TOTAL Nodes
                    <span className="text-blue-400 font-medium" aria-label={`TOTAL Nodes: ${nodeStats.total}`}>
                      {nodeStats.total}
                    </span>
                  </div>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systems.length > 0 ? (
              <div className="flex flex-wrap" role="list" aria-label="Node cards">
                {systems.map((node: HistoricalNode, index: number) => (
                  <NodeCard
                    key={node.hostname}
                    size={100}
                    name={node.hostname}
                    load={node.cpu_load}
                    partitions={node.partitions}
                    features={node.features || []}
                    coresTotal={node.cpus}
                    coresUsed={node.alloc_cpus}
                    memoryTotal={node.real_memory}
                    memoryUsed={node.alloc_memory}
                    status={node.state}
                    nodeData={node}
                    historical={true}
                  />
                ))}
              </div>
            ) : (
              <p>No node data available in the historical data.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardHistory;
