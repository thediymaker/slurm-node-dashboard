// components/DashboardHistory.tsx
"use client";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Node, parseGpuInfo } from "@/utils/nodes";
import { NodeCard } from "@/components/nodeCard/node-card";
import { DateTimePicker } from "@/components/date-time";

interface HistoricalData {
  nodes: Node[];
  timestamp: string;
  last_update: {
    number: number;
  };
}

const fetcher = async (url: string): Promise<HistoricalData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(
      errorData.message || "An error occurred while fetching the data."
    );
  }
  return res.json();
};

const DashboardHistory: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(
    undefined
  );
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setSelectedDate(now);
    setSelectedTime(format(now, "HH:00"));
  }, []);

  const { data: historicalData, error } = useSWR<HistoricalData, Error>(
    isMounted && selectedDate && selectedTime
      ? `/api/rewind?date=${format(
          selectedDate,
          "yyyy-MM-dd"
        )}&time=${selectedTime}`
      : null,
    fetcher
  );

  if (!isMounted) {
    return <div>Loading...</div>; // or any other placeholder
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <DateTimePicker
          date={selectedDate}
          setDate={setSelectedDate}
          time={selectedTime}
          setTime={setSelectedTime}
        />
      </div>
      {error && (
        <div className="text-red-500 mb-4">
          <p>Error loading historical data: {error.message}</p>
          <p>Please check the console for more details.</p>
        </div>
      )}
      {historicalData && (
        <Card>
          <CardHeader>
            <CardTitle>
              Historical Data for{" "}
              {selectedDate && format(selectedDate, "yyyy-MM-dd")} at{" "}
              {selectedTime}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historicalData.nodes ? (
              <div className="flex flex-wrap">
                {historicalData.nodes.map((node: any, index: number) => {
                  const { gpuUsed, gpuTotal } = parseGpuInfo(node);
                  return (
                    <NodeCard
                      key={node.hostname}
                      size={100}
                      name={node.hostname}
                      load={node.cpu_load}
                      partitions={node.partitions}
                      features={node.features}
                      coresTotal={node.cpus}
                      coresUsed={node.alloc_cpus}
                      memoryTotal={node.real_memory}
                      memoryUsed={node.alloc_memory}
                      status={node.state}
                      gpuUsed={gpuUsed}
                      gpuTotal={gpuTotal}
                      index={index}
                      nodeData={node}
                      dropdownOpenStatus={{}}
                      toggleDropdown={() => {}}
                    />
                  );
                })}
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
