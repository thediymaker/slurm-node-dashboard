// app/api/prometheus/utilization/route.ts
import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

// Types for Prometheus responses
interface PrometheusMetric {
  labels: {
    [key: string]: string;
  };
}

interface PrometheusValue {
  time: number;
  value: string;
}

interface PrometheusResult {
  metric: PrometheusMetric;
  values: PrometheusValue[];
}

interface PrometheusQueryResponse {
  result: PrometheusResult[];
  resultType: string;
}

interface UtilizationResponse {
  status: number;
  score?: number;
  timeWindow?: string;
  message?: string;
  debug?: {
    node: string;
    instance: string;
    query: string;
    dataPoints: number;
    firstValue: number;
    lastValue: number;
  };
  error?: string;
}

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;
const HOURS_TO_ANALYZE = 24;

let prom: PrometheusDriver | null = null;

if (PROMETHEUS_URL) {
  prom = new PrometheusDriver({
    endpoint: PROMETHEUS_URL,
    baseURL: "/api/v1",
  });
}

export async function GET(
  req: Request
): Promise<NextResponse<UtilizationResponse>> {
  const url = new URL(req.url);
  const node = url.searchParams.get("node") || "";

  if (!prom) {
    return NextResponse.json({ status: 404 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - HOURS_TO_ANALYZE * 60 * 60 * 1000);
  const step = 5 * 60 * 3; // 15 minute intervals

  try {
    // First get the instance name for this node
    const unameQuery = `node_uname_info{nodename=~"${node}"}`;
    console.log("Uname query:", unameQuery);

    const unameRes = (await prom.rangeQuery(
      unameQuery,
      start,
      end,
      step
    )) as unknown as { result: PrometheusResult[] };

    console.log("Uname response:", JSON.stringify(unameRes.result, null, 2));

    const instance = unameRes.result[0]?.metric?.labels["instance"];
    if (!instance) {
      return NextResponse.json({
        status: 404,
        message: `No instance found for node: ${node}`,
      });
    }

    // Query CPU usage for this specific instance
    const cpuQuery = `
      100 - (
        avg by (instance) (
          rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[5m])
        ) * 100
      )
    `;
    console.log("CPU query:", cpuQuery);

    const cpuRes = (await prom.rangeQuery(
      cpuQuery,
      start,
      end,
      step
    )) as unknown as { result: PrometheusResult[] };

    console.log("CPU response first value:", cpuRes.result[0]?.values[0]);

    if (!cpuRes.result || cpuRes.result.length === 0) {
      return NextResponse.json({
        status: 404,
        message: `No CPU data found for instance: ${instance}`,
      });
    }

    // Calculate the average utilization
    const values = cpuRes.result[0].values.map((v) => parseFloat(v.value));
    const validValues = values.filter((v) => !isNaN(v));
    const averageUtilization =
      validValues.length > 0
        ? Math.round(
            validValues.reduce((a, b) => a + b, 0) / validValues.length
          )
        : 0;

    const score = Math.min(Math.max(averageUtilization, 0), 100);

    return NextResponse.json({
      status: 200,
      score,
      timeWindow: `${HOURS_TO_ANALYZE}h`,
      debug: {
        node,
        instance,
        query: cpuQuery,
        dataPoints: validValues.length,
        firstValue: validValues[0],
        lastValue: validValues[validValues.length - 1],
      },
    });
  } catch (error) {
    console.error("Error querying Prometheus:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
