// app/api/prometheus/job-metrics/simplified-summary/route.ts
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

/**
 * Tries several strategies to extract a numeric value from a query result item.
 */
function extractNumericValue(item: any): number | null {
  // If a getValue() method exists, use it first.
  if (typeof item.getValue === "function") {
    const raw = item.getValue();
    if (Array.isArray(raw) && raw.length > 1) {
      return parseFloat(raw[1]);
    }
    if (raw && typeof raw === "object" && "value" in raw) {
      return parseFloat(raw.value);
    }
  }

  // Try accessing the "value" property directly
  if ("value" in item) {
    const raw = item["value"];
    if (Array.isArray(raw) && raw.length > 1) {
      return parseFloat(raw[1]);
    }
    if (raw && typeof raw === "object" && "value" in raw) {
      return parseFloat(raw.value);
    }
  }

  // Fallback: iterate over own keys to find one that might contain the value.
  const keys = Reflect.ownKeys(item);
  for (const key of keys) {
    if (key.toString().toLowerCase().includes("value")) {
      const raw = item[key];
      if (Array.isArray(raw) && raw.length > 1) {
        return parseFloat(raw[1]);
      }
      if (raw && typeof raw === "object" && "value" in raw) {
        return parseFloat(raw.value);
      }
    }
  }
  return null;
}

export async function GET(req: Request) {
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
    const timeRanges = ["1d", "7d", "30d"];
    const result: Record<string, any> = {};

    for (const range of timeRanges) {
      console.log(`Processing ${range} data...`);
      const metricName = `job:gpu_utilization:${range}_avg`;

      try {
        console.log(`Querying ${metricName} directly`);
        const metricResponse = await prom.instantQuery(metricName);
        console.log(`Raw response for ${metricName}:`, metricResponse);

        const totalJobs = metricResponse.result.length;
        let totalUtilization = 0;
        let underutilizedCount = 0;
        const jobUtilizations: Array<{ job: string; utilization: number }> = [];

        // Process each result item to extract the numeric utilization value.
        metricResponse.result.forEach((item: any) => {
          const numericValue = extractNumericValue(item);
          // Get the job id from item.metric.labels.hpc_job
          const jobId = item.metric?.labels?.hpc_job || "unknown";
          console.log(
            "Extracted numericValue:",
            numericValue,
            "for job:",
            jobId
          );
          if (numericValue !== null && !isNaN(numericValue)) {
            totalUtilization += numericValue;
            jobUtilizations.push({
              job: jobId,
              utilization: numericValue,
            });
            if (numericValue < 30) {
              underutilizedCount++;
            }
          }
        });

        const avgUtilization =
          jobUtilizations.length > 0
            ? totalUtilization / jobUtilizations.length
            : 0;

        result[range] = {
          avgUtilization,
          jobUtilizations,
          underutilizedCount,
          totalJobs,
          underutilizedPercentage:
            totalJobs > 0 ? (underutilizedCount / totalJobs) * 100 : 0,
          raw: {
            resultCount: totalJobs,
            sampleResults: metricResponse.result.slice(0, 3).map((r: any) => {
              return {
                metric: r.metric,
                value: extractNumericValue(r),
              };
            }),
          },
        };
      } catch (err: any) {
        console.error(`Error processing ${range} data:`, err);
        result[range] = {
          avgUtilization: 0,
          jobUtilizations: [],
          underutilizedCount: 0,
          totalJobs: 0,
          underutilizedPercentage: 0,
          error: err.message,
        };
      }
    }

    return NextResponse.json({
      status: 200,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching job metrics summary:", error);
    return NextResponse.json(
      {
        status: 500,
        error: "Failed to fetch metrics summary",
        details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      },
      { status: 500 }
    );
  }
}
