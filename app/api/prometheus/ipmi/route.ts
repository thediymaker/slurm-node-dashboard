import { PrometheusQueryResponse } from "@/types/types";
import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

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
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const powerQuery = 'ipmi_power_watts{name="Pwr Consumption"}';

    const timeRangeSeconds = (now.getTime() - sixHoursAgo.getTime()) / 1000;
    const stepSize = Math.max(
      Math.floor(timeRangeSeconds / MAX_DATA_POINTS),
      60
    );

    const historicalRes: PrometheusQueryResponse = await prom.rangeQuery(
      powerQuery,
      sixHoursAgo,
      now,
      stepSize
    );

    const timeSeriesMap = new Map<
      number,
      {
        totalWatts: number;
        nodeCount: number;
      }
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
        averageWatts: Math.round(totalWatts / nodeCount),
        nodesReporting: nodeCount,
      }))
      .sort((a, b) => a.time - b.time)
      .slice(-MAX_DATA_POINTS);

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
