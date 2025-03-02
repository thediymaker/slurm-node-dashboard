import { PrometheusQueryResponse } from "@/types/types";
import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

let prom: PrometheusDriver | null = null;

if (PROMETHEUS_URL) {
  prom = new PrometheusDriver({
    endpoint: PROMETHEUS_URL,
    baseURL: "/api/v1",
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const node = url.searchParams.get("node") || "";

  if (!prom) {
    console.error(
      "Prometheus client not initialized. PROMETHEUS_URL:",
      PROMETHEUS_URL
    );
    return NextResponse.json({
      status: 404,
      message: "Prometheus connection not configured",
      debug: { prometheusUrl: PROMETHEUS_URL },
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
      const value = Array.isArray(series.value)
        ? series.value[1]
        : typeof series.value === "object"
        ? series.value.value
        : series.value;

      return {
        gpu: series.metric?.labels?.gpu || "unknown",
        modelName: series.metric?.labels?.modelName || "unknown",
        hpcJob: series.metric?.labels?.hpc_job || "unknown",
        utilization: parseFloat(
          parseFloat(value?.toString() || "0").toFixed(2)
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
