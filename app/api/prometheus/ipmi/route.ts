import { PrometheusQueryResponse } from "@/types/types";
import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

export const revalidate = 0;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL;
const MAX_DATA_POINTS = 200;

let prom: PrometheusDriver | null = null;

if (PROMETHEUS_URL) {
  prom = new PrometheusDriver({
    endpoint: PROMETHEUS_URL,
    baseURL: "/api/v1",
  });
}

export async function GET(req: Request) {
  if (!prom) {
    return NextResponse.json({ status: 404 });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const stepSize = 900;

    const powerQuery =
      'avg_over_time(ipmi_power_watts{name="Pwr Consumption"}[15m])';

    const historicalRes: PrometheusQueryResponse = await prom.rangeQuery(
      powerQuery,
      twentyFourHoursAgo,
      now,
      stepSize
    );

    // Check if we have any results
    if (!historicalRes?.result?.length) {
      return NextResponse.json({
        status: 200,
        data: [],
        summary: {
          currentTotal: 0,
          currentAverage: 0,
          nodesReporting: 0,
        },
      });
    }

    const timeSeriesMap = new Map<
      number,
      { totalWatts: number; nodeCount: number }
    >();

    historicalRes.result.forEach((series) => {
      series.values.forEach(({ time, value }) => {
        const timeKey = Number(time);
        const existing = timeSeriesMap.get(timeKey) || {
          totalWatts: 0,
          nodeCount: 0,
        };

        existing.totalWatts += parseFloat(value.toString());
        existing.nodeCount += 1;
        timeSeriesMap.set(timeKey, existing);
      });
    });

    const timeSeriesData = Array.from(timeSeriesMap.entries())
      .map(([time, { totalWatts, nodeCount }]) => ({
        time,
        watts: Math.round(totalWatts),
        averageWatts: nodeCount ? Math.round(totalWatts / nodeCount) : 0,
        nodesReporting: nodeCount,
      }))
      .sort((a, b) => a.time - b.time)
      .slice(-MAX_DATA_POINTS);

    // Check if we have any processed data
    if (!timeSeriesData.length) {
      return NextResponse.json({
        status: 200,
        data: [],
        summary: {
          currentTotal: 0,
          currentAverage: 0,
          nodesReporting: 0,
        },
      });
    }

    const lastPoint = timeSeriesData[timeSeriesData.length - 1];

    return NextResponse.json({
      status: 200,
      data: timeSeriesData,
      summary: {
        currentTotal: lastPoint.watts,
        currentAverage: lastPoint.averageWatts,
        nodesReporting: lastPoint.nodesReporting,
      },
    });
  } catch (error) {
    console.error("Error fetching power data:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
