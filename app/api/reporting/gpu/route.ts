// app/api/reporting/gpu/route.ts
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

// Helper to extract a numeric value from a Prometheus response.
const extractValue = (result: any): number | null => {
  const series = result?.result?.[0];
  if (!series) return null;
  const value = Array.isArray(series.value) ? series.value[1] : series.value;
  return parseFloat(value?.toString() ?? "0");
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");

  if (!prom) {
    return NextResponse.json({
      status: 404,
      message: "Prometheus not configured",
    });
  }

  try {
    // Use Prometheus recording rules.
    const avgQuery = `job:gpu_utilization:avg_7d{job_id="${jobId}"}`;
    const wastedQuery = `job:wasted_gpu_hours{job_id="${jobId}"}`;
    const underutilizedQuery = `job:underutilized_count_total`;

    // Execute queries in parallel.
    const [avgRes, wastedRes, underutilizedRes] = await Promise.all([
      prom.instantQuery(avgQuery),
      prom.instantQuery(wastedQuery),
      prom.instantQuery(underutilizedQuery),
    ]);

    const averageUtilization = extractValue(avgRes);
    const wastedGpuHours = extractValue(wastedRes);
    const underutilizedCount = extractValue(underutilizedRes);

    return NextResponse.json({
      status: 200,
      data: {
        jobId,
        averageUtilization,
        wastedGpuHours,
        underutilizedCount,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 500,
      message: "Error fetching reporting GPU metrics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
