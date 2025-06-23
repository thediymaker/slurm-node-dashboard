import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { GPUResources } from "@/types/types";

interface GPUResourcesDisplayProps {
  gpuResources?: GPUResources;
  hostname: string;
  nodeData: {
    gres: string;
    gres_used: string;
  };
}

interface GPUUtilization {
  gpu: string;
  modelName: string;
  utilization: number;
}

const GPUResourcesDisplay: React.FC<GPUResourcesDisplayProps> = ({
  gpuResources,
  hostname,
  nodeData,
}) => {
  const [utilData, setUtilData] = useState<GPUUtilization[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hasPrometheusData, setHasPrometheusData] = useState(false);

  if (!gpuResources) return null;

  useEffect(() => {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";
    const fetchUtilization = async () => {
      try {
        const response = await fetch(
          `${baseURL}/api/prometheus/dcgm?node=${encodeURIComponent(hostname)}`
        );
        const result = await response.json();
        if (result.status === 200 && result.data?.length > 0) {
          setUtilData(result.data);
          setHasPrometheusData(true);
        } else {
          setHasPrometheusData(false);
        }
      } catch (err) {
        console.error("Failed to fetch GPU utilization:", err);
        setHasPrometheusData(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUtilization();
    const interval = setInterval(fetchUtilization, 60 * 1000);
    return () => clearInterval(interval);
  }, [hostname]);

  const getGPUUtilization = (gpuIndex: string) => {
    const gpu = utilData.find((d) => d.gpu === gpuIndex);
    return gpu?.utilization ?? null;
  };

  const renderGPUUsage = (sliceType: string, total: number, used: number) => {
    const utilizations = hasPrometheusData
      ? Array.from({ length: total })
          .map((_, i) => getGPUUtilization(i.toString()))
          .filter((val): val is number => val !== null)
      : [];

    const avgUtilization =
      utilizations.length > 0
        ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length
        : 0;

    return (
      <div key={sliceType} className="space-y-2">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-md font-medium">{sliceType}</div>
              <p className="text-xs text-muted-foreground">
                {used} of {total} Allocated
              </p>
            </div>
            {hasPrometheusData && !loading && (
              <div className="text-right">
                <div className="text-md font-medium">
                  {avgUtilization.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Utilization</p>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full bg-secondary rounded-full">
            <div
              className="h-1.5 bg-primary rounded-full transition-all"
              style={{ width: `${(used / total) * 100}%` }}
            />
          </div>

          {hasPrometheusData && total > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs mt-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  Hide <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  Show GPUs <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>

        {hasPrometheusData && expanded && total > 1 && (
          <div className="grid grid-cols-4 gap-2 mt-1">
            {Array.from({ length: total }).map((_, index) => {
              const utilization = getGPUUtilization(index.toString());
              const isAllocated = index < used;

              return (
                <div
                  key={index}
                  className="bg-secondary/10 rounded-md px-1 py-2 space-y-1.5"
                >
                  <div className="flex items-baseline gap-1">
                    <div className="">
                      <span className="text-xs font-medium text-gray-400">
                        GPU
                      </span>
                      <span className="text-xs font-medium text-gray-400">
                        {index}
                      </span>
                    </div>
                    {utilization !== null && (
                      <span className="text-xs font-medium">
                        {utilization.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {utilization !== null && (
                    <div className="h-0.5 w-full bg-secondary rounded-full">
                      <div
                        className="h-0.5 bg-primary rounded-full transition-all"
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  switch (gpuResources.sliceType) {
    case "MIG":
      return (
        <div className="space-y-4">
          {Object.entries(gpuResources.slices.total).map(([sliceType, total]) =>
            renderGPUUsage(
              `MIG ${sliceType}`,
              total,
              gpuResources.slices.used[sliceType]
            )
          )}
        </div>
      );
    case "SHARD":
      return (
        <div className="space-y-4">
          {renderGPUUsage(
            "Physical GPUs",
            gpuResources.slices.total["GPU"],
            gpuResources.slices.used["GPU"]
          )}
          {renderGPUUsage(
            "GPU Shards",
            gpuResources.slices.total["SHARD"],
            gpuResources.slices.used["SHARD"]
          )}
        </div>
      );
    default:
      return (
        <div className="space-y-4">
          {Object.entries(gpuResources.slices.total).map(([gpuType, total]) =>
            renderGPUUsage(
              gpuType.toUpperCase(),
              total,
              gpuResources.slices.used[gpuType]
            )
          )}
        </div>
      );
  }
};

export default GPUResourcesDisplay;
