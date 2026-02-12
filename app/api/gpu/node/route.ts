export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { extractNumericValue } from "@/lib/gpu-metrics";

export async function GET(req: Request) {
  const node = new URL(req.url).searchParams.get("name");

  if (!node) {
    return NextResponse.json({
      status: 400,
      message: "Missing required 'name' parameter",
    });
  }

  if (!prom) {
    return NextResponse.json({
      status: 404,
      message: "Prometheus connection not configured",
    });
  }

  try {
    const prometheusQuery = `avg_over_time(DCGM_FI_DEV_GPU_UTIL{Hostname="${node}"}[5m])`;
    const gpuRes = await prom.instantQuery(prometheusQuery);

    if (!gpuRes.result || gpuRes.result.length === 0) {
      return NextResponse.json({
        status: 404,
        message: "No GPU data found for the specified node.",
        debug: { query: prometheusQuery },
      });
    }

    const gpuData = gpuRes.result.map((series: any) => {
      const value = extractNumericValue(series.value);

      return {
        gpu: series.metric?.labels?.gpu || "unknown",
        modelName: series.metric?.labels?.modelName || "unknown",
        hpcJob: series.metric?.labels?.hpc_job || "unknown",
        utilization: parseFloat(
          (isNaN(value) ? 0 : value).toFixed(2)
        ),
      };
    });

    return NextResponse.json({
      status: 200,
      data: gpuData,
    });
  } catch (error) {
    console.error("Error fetching GPU metrics:", error);
    return NextResponse.json({
      status: 500,
      message: "Error fetching GPU metrics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
