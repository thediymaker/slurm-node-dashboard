export const dynamic = 'force-dynamic';

import { PrometheusQueryResponse } from "@/types/types";
import { NextResponse } from "next/server";
import { prom } from "@/lib/prometheus";
import { fetchSlurmData } from "@/lib/slurm-api";

const MAX_DATA_POINTS = 200;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache for node list

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
    return clusterNodesCache.nodes;
  }

  try {
    // Fetch node information directly from Slurm API
    const { data, error } = await fetchSlurmData('/nodes');

    if (error || !data?.nodes || !Array.isArray(data.nodes)) {
      console.warn("Failed to fetch nodes from Slurm API");
      return [];
    }

    // Extract node names
    const nodeNames = data.nodes
      .map((node: any) => node.name || null)
      .filter(Boolean);

    console.log(`Fetched ${nodeNames.length} nodes from Slurm API`);

    // Update cache
    clusterNodesCache = {
      timestamp: now,
      nodes: nodeNames,
    };

    return nodeNames;
  } catch (err) {
    console.error("Error fetching cluster nodes:", err);
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
        )}"}[15m]) or avg_over_time(ipmi_dcmi_power_consumption_watts{hostname=~"${clusterNodes.join(
          "|"
        )}"}[15m])`,

        // Try matching on instance
        `avg_over_time(ipmi_power_watts{name="Pwr Consumption", instance=~"${clusterNodes.join(
          "|"
        )}"}[15m]) or avg_over_time(ipmi_dcmi_power_consumption_watts{instance=~"${clusterNodes.join(
          "|"
        )}"}[15m])`,

        // Try matching on node field
        `avg_over_time(ipmi_power_watts{name="Pwr Consumption", node=~"${clusterNodes.join(
          "|"
        )}"}[15m]) or avg_over_time(ipmi_dcmi_power_consumption_watts{node=~"${clusterNodes.join(
          "|"
        )}"}[15m])`,
      ];

      // Try each pattern until we get results
      for (const pattern of patterns) {
        powerQuery = pattern;

        try {
          historicalRes = await prom.rangeQuery(
            powerQuery,
            twentyFourHoursAgo,
            now,
            stepSize
          );

          if (historicalRes?.result?.length) {
            break;
          }
        } catch (error) {
          // Pattern didn't match, try next one
        }
      }
    }

    // If we still have no results, try unfiltered query as fallback
    if (!historicalRes?.result?.length) {
      powerQuery =
        'avg_over_time(ipmi_power_watts{name="Pwr Consumption"}[15m]) or avg_over_time(ipmi_dcmi_power_consumption_watts[15m])';
      unfilteredFallback = true;

      try {
        historicalRes = await prom.rangeQuery(
          powerQuery,
          twentyFourHoursAgo,
          now,
          stepSize
        );
      } catch (error) {
        // Fallback query also failed
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

    // Collect nodes from results for cluster matching
    const nodesInResults = new Set<string>();
    historicalRes.result.forEach((series) => {
      for (const label of ["hostname", "instance", "node"]) {
        const value = series.metric?.labels?.[label];
        if (value) nodesInResults.add(value);
      }
    });

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

    // Track metrics by time and node to avoid double counting
    const metricsTracker = new Map<
      number,
      Map<
        string,
        {
          watts: number;
          metricType: string;
        }
      >
    >();

    historicalRes.result.forEach((series) => {
      // Skip nodes not in our cluster if using unfiltered query
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

      // Determine metric type
      const metricName = series.metric?.name || "";
      const isIPMI = metricName.includes("ipmi_power_watts");
      const metricType = isIPMI
        ? "ipmi_power_watts"
        : "ipmi_dcmi_power_consumption_watts";

      // Get node identifier
      let nodeId = null;
      for (const label of ["hostname", "instance", "node"]) {
        if (series.metric?.labels?.[label]) {
          nodeId = series.metric.labels[label];
          break;
        }
      }

      if (!nodeId) return; // Skip if no node identifier

      series.values.forEach(({ time, value }) => {
        const timeKey = Number(time);

        // Initialize time entry if needed
        if (!metricsTracker.has(timeKey)) {
          metricsTracker.set(timeKey, new Map());
        }

        const nodesAtTime = metricsTracker.get(timeKey)!;

        // If we already have ipmi_power_watts for this node, skip
        if (
          nodesAtTime.has(nodeId) &&
          nodesAtTime.get(nodeId)!.metricType === "ipmi_power_watts" &&
          metricType !== "ipmi_power_watts"
        ) {
          return;
        }

        // Otherwise, store this metric (overwriting ipmi_dcmi if we now have ipmi_power_watts)
        nodesAtTime.set(nodeId, {
          watts: parseFloat(value.toString()),
          metricType,
        });
      });
    });

    // Now build timeSeriesMap from our deduplicated data
    const timeSeriesData: Array<{
      time: number;
      watts: number;
      averageWatts: number;
      nodesReporting: number;
    }> = [];

    for (const [timeKey, nodesMap] of metricsTracker.entries()) {
      let totalWatts = 0;
      const nodeCount = nodesMap.size;

      for (const nodeData of nodesMap.values()) {
        totalWatts += nodeData.watts;
      }

      const averageWatts = nodeCount ? Math.round(totalWatts / nodeCount) : 0;

      timeSeriesData.push({
        time: timeKey,
        watts: Math.round(totalWatts),
        averageWatts,
        nodesReporting: nodeCount,
      });
    }

    // Sort the time series data and limit to max data points
    timeSeriesData.sort((a, b) => a.time - b.time);
    const limitedData = timeSeriesData.slice(-MAX_DATA_POINTS);

    // Check if we have any processed data
    if (!limitedData.length) {
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

    const lastPoint = limitedData[limitedData.length - 1];

    return NextResponse.json({
      status: 200,
      data: limitedData,
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
