import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

type PrometheusMetric = {
  labels: Record<string, string>;
};

type PrometheusValue = {
  time: number;
  value: string;
};

type PrometheusResult = {
  metric: PrometheusMetric;
  values: PrometheusValue[];
};

type UtilizationResponse = {
  status: number;
  score?: number;
  timeWindow?: string;
  message?: string;
  error?: string;
};

const PROMETHEUS_URL = process.env.PROMETHEUS_URL!;
const HOURS_TO_ANALYZE = 24;
const STEP_INTERVAL = 900; // 15 minutes in seconds

const prom = PROMETHEUS_URL
  ? new PrometheusDriver({
      endpoint: PROMETHEUS_URL,
      baseURL: "/api/v1",
    })
  : null;

export async function GET(
  req: Request
): Promise<NextResponse<UtilizationResponse>> {
  if (!prom) {
    return NextResponse.json({
      status: 404,
      message: "Prometheus URL not configured",
    });
  }

  const node = new URL(req.url).searchParams.get("node") || "";
  const end = new Date();
  const start = new Date(end.getTime() - HOURS_TO_ANALYZE * 60 * 60 * 1000);

  try {
    // Get instance name for the node
    const unameRes = (await prom.rangeQuery(
      `node_uname_info{nodename=~"${node}"}`,
      start,
      end,
      STEP_INTERVAL
    )) as unknown as { result: PrometheusResult[] };

    const instance = unameRes.result[0]?.metric?.labels["instance"];
    if (!instance) {
      return NextResponse.json({
        status: 404,
        message: `No instance found for node: ${node}`,
      });
    }

    // Query CPU usage
    const cpuRes = (await prom.rangeQuery(
      `100 - (avg by (instance) (rate(node_cpu_seconds_total{instance="${instance}",mode="idle"}[5m])) * 100)`,
      start,
      end,
      STEP_INTERVAL
    )) as unknown as { result: PrometheusResult[] };

    if (!cpuRes.result?.[0]?.values.length) {
      return NextResponse.json({
        status: 404,
        message: `No CPU data found for instance: ${instance}`,
      });
    }

    const values = cpuRes.result[0].values
      .map((v) => parseFloat(v.value))
      .filter((v) => !isNaN(v));

    if (!values.length) {
      return NextResponse.json({
        status: 404,
        message: `Invalid CPU data for instance: ${instance}`,
      });
    }

    const averageUtilization = Math.round(
      values.reduce((a, b) => a + b, 0) / values.length
    );

    return NextResponse.json({
      status: 200,
      score: Math.min(Math.max(averageUtilization, 0), 100),
      timeWindow: `${HOURS_TO_ANALYZE}h`,
    });
  } catch (error) {
    return NextResponse.json({
      status: 500,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
