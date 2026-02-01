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
  const days = parseInt(url.searchParams.get("days") || "3");
  const query = url.searchParams.get("query") || "node_load15";

  if (!prom) {
    return NextResponse.json({ status: 404 });
  }

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

    const instance = unameRes.result[0]?.metric?.labels["instance"];

    if (!instance) {
      return NextResponse.json({
        status: 404,
        message: "No instance found for the specified node.",
      });
    }

    // Build the appropriate query based on metric type
    let prometheusQuery: string;
    
    if (query.startsWith("DCGM_")) {
      // DCGM exporter uses Hostname label (capital H) matching the node name
      prometheusQuery = `${query}{Hostname="${node}"}`;
    } else if (query === "node_hwmon_temp_celsius") {
      // Get CPU package temperature (sensor temp1 on coretemp)
      prometheusQuery = `${query}{instance="${instance}", chip=~".*coretemp.*", sensor="temp1"}`;
    } else if (query.includes("network") && query.includes("_bytes_total")) {
      // Network counters need rate() to show throughput, exclude loopback and virtual interfaces
      prometheusQuery = `rate(${query}{instance="${instance}", device!~"lo|veth.*|docker.*|br.*|virbr.*"}[5m])`;
    } else {
      prometheusQuery = `${query}{instance="${instance}"}`;
    }

    let loadRes: PrometheusQueryResponse;
    try {
      loadRes = await prom.rangeQuery(
        prometheusQuery,
        start,
        end,
        step
      );
    } catch (queryError) {
      console.error("Prometheus query error:", queryError);
      return NextResponse.json({
        status: 404,
        message: `Query failed for metric: ${query}`,
      });
    }

    const series = loadRes.result;

    if (!series || series.length === 0) {
      return NextResponse.json({
        status: 404,
        message: `No data found for metric: ${query}. This metric may not be available on this node.`,
      });
    }

    // Define metrics that need specific conversions
    const bytesToGBMetrics = [
      "node_memory_Active_bytes",
      "node_memory_SwapFree_bytes",
      "node_memory_MemAvailable_bytes",
    ];
    
    const bytesToMBPerSecMetrics = [
      "node_network_receive_bytes_total",
      "node_network_transmit_bytes_total",
    ];
    
    const celsiusToFahrenheitMetrics = [
      "node_hwmon_temp_celsius",
      "DCGM_FI_DEV_GPU_TEMP",
    ];
    
    const dcgmMemoryMetrics = [
      "DCGM_FI_DEV_FB_USED",
      "DCGM_FI_DEV_FB_FREE",
    ];

    // Transform values based on metric type
    const transformValue = (value: number): string | number => {
      if (bytesToGBMetrics.includes(query)) {
        return (value / (1024 * 1024 * 1024)).toFixed(1);
      }
      if (bytesToMBPerSecMetrics.includes(query)) {
        // rate() gives bytes/sec, convert to MB/s (more readable than GB/s for typical network)
        return (value / (1024 * 1024)).toFixed(2);
      }
      if (celsiusToFahrenheitMetrics.includes(query)) {
        // Convert Celsius to Fahrenheit
        return ((value * 9/5) + 32).toFixed(0);
      }
      if (dcgmMemoryMetrics.includes(query)) {
        // DCGM memory is in MiB, convert to GB
        return (value / 1024).toFixed(2);
      }
      return value;
    };

    // For network metrics, aggregate all interfaces
    let dataPoints;
    if (bytesToMBPerSecMetrics.includes(query) && series.length > 1) {
      // Sum across all network interfaces per timestamp
      const timeMap = new Map<number, number>();
      series.forEach((serie) => {
        serie.values.forEach(({ time, value }) => {
          const t = time.getTime();
          timeMap.set(t, (timeMap.get(t) || 0) + value);
        });
      });
      dataPoints = Array.from(timeMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({
          time: new Date(time),
          value: transformValue(value),
        }));
    } else {
      // Use first series for single-value metrics
      dataPoints = series[0].values.map(({ time, value }) => ({
        time,
        value: transformValue(value),
      }));
    }

    return NextResponse.json({ status: 200, data: dataPoints });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ status: 500, message: "Internal Server Error" });
  }
}
