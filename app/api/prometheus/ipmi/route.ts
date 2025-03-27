import { PrometheusQueryResponse } from "@/types/types";
import { NextResponse } from "next/server";
import { PrometheusDriver } from "prometheus-query";

export const revalidate = 0;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL;
const MAX_DATA_POINTS = 200;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache for node list

let prom: PrometheusDriver | null = null;
if (PROMETHEUS_URL) {
  prom = new PrometheusDriver({
    endpoint: PROMETHEUS_URL,
    baseURL: "/api/v1",
  });
}

// Cache for cluster nodes
let clusterNodesCache: {
  timestamp: number;
  nodes: string[];
} = {
  timestamp: 0,
  nodes: [],
};

// Function to get cluster nodes with caching
async function getClusterNodes(): Promise<string[]> {
  // Return cached nodes if they're still fresh
  const now = Date.now();
  if (
    now - clusterNodesCache.timestamp < CACHE_TTL &&
    clusterNodesCache.nodes.length > 0
  ) {
    console.log("Using cached cluster nodes list");
    return clusterNodesCache.nodes;
  }

  try {
    // Fetch node information from Slurm API
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";
    const response = await fetch(`${baseURL}/api/slurm/nodes`);

    if (!response.ok) {
      throw new Error(`Failed to fetch nodes: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.nodes || !Array.isArray(data.nodes)) {
      console.warn("Invalid nodes data format from Slurm API");
      return [];
    }

    // Extract node names
    const nodeNames = data.nodes
      .map((node: any) => node.name || null)
      .filter(Boolean);

    // Update cache
    clusterNodesCache = {
      timestamp: now,
      nodes: nodeNames,
    };

    console.log(
      `Refreshed cluster nodes list: ${nodeNames.length} nodes found`
    );
    return nodeNames;
  } catch (error) {
    console.error("Error fetching cluster nodes:", error);
    return [];
  }
}

export async function GET(req: Request) {
  if (!prom) {
    return NextResponse.json({ status: 404 });
  }

  try {
    // Get the list of nodes in the cluster
    const clusterNodes = await getClusterNodes();

    if (clusterNodes.length === 0) {
      console.warn("No cluster nodes found, proceeding with unfiltered query");
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const stepSize = 900;

    // First try with the filtered query if we have cluster nodes
    let historicalRes: PrometheusQueryResponse | null = null;
    let powerQuery = "";
    let unfilteredFallback = false;

    if (clusterNodes.length > 0) {
      // Try multiple patterns for node identification
      // Prometheus metrics might store node identifiers in different label names
      const patterns = [
        // Try matching on hostname
        `avg_over_time(ipmi_power_watts{name="Pwr Consumption", hostname=~"${clusterNodes.join(
          "|"
        )}"}[15m]) or on(hostname) avg_over_time(ipmi_dcmi_power_consumption_watts{hostname=~"${clusterNodes.join(
          "|"
        )}"}[15m]) unless on(hostname) avg_over_time(ipmi_power_watts{name="Pwr Consumption", hostname=~"${clusterNodes.join(
          "|"
        )}"}[15m])`,

        // Try matching on instance
        `avg_over_time(ipmi_power_watts{name="Pwr Consumption", instance=~"${clusterNodes.join(
          "|"
        )}"}[15m]) or on(instance) avg_over_time(ipmi_dcmi_power_consumption_watts{instance=~"${clusterNodes.join(
          "|"
        )}"}[15m]) unless on(instance) avg_over_time(ipmi_power_watts{name="Pwr Consumption", instance=~"${clusterNodes.join(
          "|"
        )}"}[15m])`,

        // Try matching on node field
        `avg_over_time(ipmi_power_watts{name="Pwr Consumption", node=~"${clusterNodes.join(
          "|"
        )}"}[15m]) or on(node) avg_over_time(ipmi_dcmi_power_consumption_watts{node=~"${clusterNodes.join(
          "|"
        )}"}[15m]) unless on(node) avg_over_time(ipmi_power_watts{name="Pwr Consumption", node=~"${clusterNodes.join(
          "|"
        )}"}[15m])`,
      ];

      // Try each pattern until we get results
      for (const pattern of patterns) {
        console.log(`Trying power query pattern: ${pattern}`);
        powerQuery = pattern;

        try {
          historicalRes = await prom.rangeQuery(
            powerQuery,
            twentyFourHoursAgo,
            now,
            stepSize
          );

          if (historicalRes?.result?.length) {
            console.log(
              `Found ${historicalRes.result.length} series with pattern: ${pattern}`
            );
            break;
          }
        } catch (error) {
          console.warn(`Pattern failed: ${pattern}`, error);
        }
      }
    }

    // If we still have no results, try unfiltered query as fallback
    if (!historicalRes?.result?.length) {
      console.log(
        "No results with filtered queries, trying unfiltered query as fallback"
      );
      powerQuery =
        'avg_over_time(ipmi_power_watts{name="Pwr Consumption"}[15m]) or on() avg_over_time(ipmi_dcmi_power_consumption_watts[15m]) unless on() avg_over_time(ipmi_power_watts{name="Pwr Consumption"}[15m])';
      unfilteredFallback = true;

      try {
        historicalRes = await prom.rangeQuery(
          powerQuery,
          twentyFourHoursAgo,
          now,
          stepSize
        );
      } catch (error) {
        console.error("Error with unfiltered query:", error);
      }
    }

    // Check if we have any results
    if (!historicalRes?.result?.length) {
      return NextResponse.json({
        status: 200,
        data: [],
        summary: {
          currentTotal: 0,
          currentAverage: 0,
          nodesReporting: 0,
          // Important: signal to the frontend that no Prometheus power data was found
          noPrometheusData: true,
        },
      });
    }

    // Log which nodes are included in the results for debugging
    const nodesInResults = new Set<string>();
    historicalRes.result.forEach((series) => {
      for (const label of ["hostname", "instance", "node"]) {
        const value = series.metric?.labels?.[label];
        if (value) nodesInResults.add(value);
      }
    });
    console.log(
      `Nodes included in results: ${Array.from(nodesInResults).join(", ")}`
    );

    // If using unfiltered query, check how many of the result nodes are actually in our cluster
    let clusterNodeMatch = [];
    if (unfilteredFallback && clusterNodes.length > 0) {
      clusterNodeMatch = Array.from(nodesInResults).filter((resultNode) =>
        clusterNodes.some((clusterNode) => resultNode.includes(clusterNode))
      );
      console.log(
        `Matched ${clusterNodeMatch.length} nodes to cluster out of ${nodesInResults.size} in unfiltered results`
      );
    }

    const timeSeriesMap = new Map<
      number,
      { totalWatts: number; nodeCount: number }
    >();

    historicalRes.result.forEach((series) => {
      // If using unfiltered fallback, check if this series belongs to a cluster node
      if (unfilteredFallback && clusterNodes.length > 0) {
        const nodeInCluster = Object.values(series.metric?.labels || {}).some(
          (label) =>
            typeof label === "string" &&
            clusterNodes.some((node) => label.includes(node))
        );

        if (!nodeInCluster) {
          return; // Skip this series if it's not for a cluster node
        }
      }

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
          noPrometheusData: true,
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
        clusterSize: clusterNodes.length,
        unfilteredFallback: unfilteredFallback,
        clusterNodeMatches: clusterNodeMatch?.length || 0,
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
