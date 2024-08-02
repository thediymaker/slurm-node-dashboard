import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

const prom = new PrometheusDriver({
  endpoint: `${process.env.PROMETHEUS_URL}` || "",
  baseURL: "/api/v1",
});

interface SampleValue {
  time: Date;
  value: number;
}

interface PrometheusQueryResponse {
  resultType: string;
  result: Array<{
    metric: {
      name: string;
      labels: Record<string, string>;
    };
    values: SampleValue[];
  }>;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const node = url.searchParams.get("node") || "";
  const days = parseInt(url.searchParams.get("days") || "3");
  const query = url.searchParams.get("query") || "node_load15";

  console.log("Node:", node, "Days:", days, "Query:", query);

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const step = 15 * 60; // 15 minutes

  try {
    const unameQuery = "node_uname_info";
    const unameRes: PrometheusQueryResponse = await prom.rangeQuery(
      `${unameQuery}{nodename="${node}"}`,
      start,
      end,
      step
    );
    console.log("Node Info Response:", unameRes);

    const instance = unameRes.result[0]?.metric?.labels["instance"];

    if (!instance) {
      return NextResponse.json({
        status: 404,
        message: "No instance found for the specified node.",
      });
    }

    const prometheusQuery = `${query}{instance="${instance}"}`;
    console.log("Constructed Query:", prometheusQuery);

    const loadRes: PrometheusQueryResponse = await prom.rangeQuery(
      prometheusQuery,
      start,
      end,
      step
    );
    console.log("Load Query Response:", loadRes);

    const series = loadRes.result;

    if (series.length === 0) {
      console.log("No data returned for the query.");
      return NextResponse.json({
        status: 404,
        message: "No data found for the specified instance.",
      });
    }

    // Convert bytes to GB if the query is "node_memory_Active_bytes"
    const dataPoints = series.flatMap((serie) =>
      serie.values.map(({ time, value }) => ({
        time,
        value:
          query === "node_memory_Active_bytes"
            ? (value / (1024 * 1024 * 1024)).toFixed(1)
            : value,
      }))
    );

    return NextResponse.json({ status: 200, data: dataPoints });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ status: 500, message: "Internal Server Error" });
  }
}
