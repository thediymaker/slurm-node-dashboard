"use client";

import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import NodeCardModal from "@/components/modals/card-job-modal";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { Node, NodeConfig } from "@/types/types";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import { useColorSchema } from "@/components/use-color-schema";
import { useFeature, useRuntimeConfig } from "@/components/runtime-config";
import { LogicType } from "@/components/feature-selector";
import { withBasePath } from "@/lib/base-path";
import type { NodeExtras } from "@/app/api/nodes/extras/route";
import ClusterSummary from "./cluster-summary";
import NodeToolbar from "./node-toolbar";
import { GroupBy, NodeGroups } from "./node-grid";
import { CardSize, STATE_ORDER, TILE_WIDTH, isOverloaded, needsAttention, stateOf } from "./node-view";

const nodeURL = withBasePath("/api/slurm/nodes");
const nodeFetcher = async () => {
  try {
    const res = await fetch(nodeURL, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: 'no-store', // Prevent caching to always get fresh data
    });
    
    // Handle auth-related redirects or errors
    if (res.status === 401 || res.status === 403) {
      const error = new Error("Session expired. Please refresh the page to re-authenticate.");
      (error as any).isAuthError = true;
      throw error;
    }
    
    // Handle redirects (CAS may redirect on timeout)
    if (res.redirected || res.type === 'opaqueredirect') {
      const error = new Error("Session expired. Please refresh the page to re-authenticate.");
      (error as any).isAuthError = true;
      throw error;
    }
    
    if (!res.ok) {
      // Try to extract error message from response
      let errorMessage = "Network response was not ok";
      try {
        const errorData = await res.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Use default message
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (err: any) {
    // Handle network failures gracefully (including auth redirects that fail)
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      const error = new Error("Connection failed. Please refresh the page.");
      (error as any).isConnectionError = true;
      throw error;
    }
    // Re-throw other errors (including our custom ones)
    throw err;
  }
};

const jsonFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

// localStorage can throw in private windows; fall back to the default
function stored<T>(key: string, parse: (raw: string) => T | undefined, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage
  }
}

const GROUP_BYS: GroupBy[] = ["rack", "partition", "state", "none"];

const Nodes = () => {
  const prometheusEnabled = useFeature("prometheus");
  const nodeHistoryEnabled = useFeature("nodeHistory");
  const { nodeTempWarn } = useRuntimeConfig();
  // Track connection errors that occur during revalidation
  const [lastFetchError, setLastFetchError] = useState<Error | null>(null);

  const {
    data: nodeData,
    error: nodeError,
    isLoading: nodeIsLoading,
  } = useSWR(nodeURL, nodeFetcher, {
    refreshInterval: 15000,
    onSuccess: () => setLastFetchError(null),
    // Track errors even when we have cached data
    onError: (err) => setLastFetchError(err),
  });

  // Determine if we have a connection issue (either initial error or revalidation error)
  const hasConnectionError = !!(nodeError || (lastFetchError && nodeData));

  const [cardSize, setCardSize] = useState<CardSize>(() =>
    stored("cardSize", (raw) => ([50, 100, 150].includes(Number(raw)) ? (Number(raw) as CardSize) : undefined), 100)
  );
  const [colorSchema] = useColorSchema();
  // /?node=<name> (linked from Job Metrics) opens that node's detail panel
  const router = useRouter();
  const linkedNode = useSearchParams().get("node");
  // Before 3.0 there was a separate rack list view; carry that choice over
  const [groupBy, setGroupBy] = useState<GroupBy>(() =>
    stored(
      "groupBy",
      (raw) => (GROUP_BYS.includes(raw as GroupBy) ? (raw as GroupBy) : undefined),
      stored("isGroupedView", (raw) => (raw === "true" ? "rack" : "none"), "none") as GroupBy
    )
  );
  const [selectedNodeFeatures, setSelectedNodeFeatures] = useState<string[]>(() =>
    stored("selectedNodeFeatures", (raw) => {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : undefined;
    }, [] as string[])
  );
  const [featureLogicType, setFeatureLogicType] = useState<LogicType>(() =>
    stored("featureLogicType", (raw) => (raw === "OR" ? "OR" : "AND"), "AND" as LogicType)
  );
  const [nodeType, setNodeType] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [partition, setPartition] = useState("all");

  useEffect(() => save("cardSize", String(cardSize)), [cardSize]);
  useEffect(() => save("groupBy", groupBy), [groupBy]);
  useEffect(() => save("selectedNodeFeatures", JSON.stringify(selectedNodeFeatures)), [selectedNodeFeatures]);
  useEffect(() => save("featureLogicType", featureLogicType), [featureLogicType]);

  // Rack layout from node.cfg; a site without one just doesn't get the Rack option
  const { data: rackConfig } = useSWR<NodeConfig | null>(withBasePath("/api/node-config"), async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data && !data.error ? data : null;
  }, { revalidateOnFocus: false });
  const hasRacks = !!rackConfig && Object.keys(rackConfig).length > 0;
  const effectiveGroupBy: GroupBy = groupBy === "rack" && rackConfig !== undefined && !hasRacks ? "none" : groupBy;

  // Power, temperature, GPU busyness and load trend only show on large cards
  const { data: extrasData } = useSWR<{ enabled: boolean; nodes: Record<string, NodeExtras> } | null>(
    cardSize === 150 && prometheusEnabled ? withBasePath("/api/nodes/extras") : null,
    jsonFetcher,
    { refreshInterval: 30000 }
  );

  // Nodes that went unavailable or came back in the last few minutes get a ring
  const { data: recentData } = useSWR<{ changes?: { node: string }[] } | null>(
    nodeHistoryEnabled ? withBasePath("/api/node-history/recent") : null,
    jsonFetcher,
    { refreshInterval: 60000 }
  );
  const changed = useMemo(() => new Set((recentData?.changes ?? []).map((c) => c.node)), [recentData]);

  const systems: Node[] = useMemo(() => nodeData?.nodes || [], [nodeData]);

  const uniquePartitions = useMemo(() => {
    const partitions = new Set<string>();
    systems.forEach((node) => node.partitions.forEach((p) => partitions.add(p)));
    return Array.from(partitions).sort();
  }, [systems]);

  const uniqueFeatures = useMemo(() => {
    const features = new Set<string>();
    systems.forEach((node) => node.features?.forEach((f) => f && features.add(f)));
    return Array.from(features).sort();
  }, [systems]);

  const filteredNodes = useMemo(() => {
    return systems.filter((node: any) => {
      if (nodeType === "gpu" && !node.gres) return false;
      if (nodeType === "cpu" && node.gres) return false;
      if (partition !== "all" && !node.partitions.includes(partition)) return false;
      if (stateFilter === "attention" && !needsAttention(node)) return false;
      if (stateFilter === "overloaded" && !isOverloaded(node)) return false;
      if (STATE_ORDER.includes(stateFilter as never) && stateOf(node) !== stateFilter) return false;

      if (selectedNodeFeatures.length > 0) {
        const has = (feature: string) => Array.isArray(node.features) && node.features.includes(feature);
        const matches = featureLogicType === "AND" ? selectedNodeFeatures.every(has) : selectedNodeFeatures.some(has);
        if (!matches) return false;
      }
      return true;
    });
  }, [systems, nodeType, partition, stateFilter, selectedNodeFeatures, featureLogicType]);

  // Check if we have an error (using either nodeError or lastFetchError)
  const activeError = nodeError || lastFetchError;
  const isAuthError = (activeError as any)?.isAuthError === true;
  const isConnectionError = (activeError as any)?.isConnectionError === true ||
                            activeError?.message?.includes("Unable to contact Slurm controller") ||
                            activeError?.message?.includes("service may be down") ||
                            activeError?.message?.includes("Network response was not ok") ||
                            activeError?.message?.includes("Connection failed") ||
                            activeError?.message?.includes("fetch");

  // Only show full error state if we have NO data
  if (nodeError && !nodeData) {
    let errorMessage = "An error occurred loading node data. Please try refreshing the page.";

    if (isAuthError) {
      errorMessage = "Your session has expired. Please refresh the page to re-authenticate.";
    } else if (isConnectionError) {
      errorMessage = "Unable to connect. The service may be down or unreachable. Please try refreshing the page.";
    }

    return (
      <div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (nodeIsLoading) {
    return (
      <div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[104px] w-full rounded-xl" />
          <Skeleton className="h-8 w-full max-w-[720px]" />
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_WIDTH[cardSize]}px, 1fr))` }}
          >
            {Array.from({ length: 120 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-[9px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-20 flex flex-col gap-4">
        <ClusterSummary
          nodes={systems}
          colorSchema={colorSchema}
          lastUpdate={nodeData?.last_update?.number}
          connectionError={hasConnectionError}
          stateFilter={stateFilter}
          onStateFilter={setStateFilter}
        />
        <NodeToolbar
          partitions={uniquePartitions}
          features={uniqueFeatures}
          partition={partition}
          state={stateFilter}
          nodeType={nodeType}
          selectedFeatures={selectedNodeFeatures}
          featureLogicType={featureLogicType}
          groupBy={effectiveGroupBy}
          hasRacks={hasRacks}
          size={cardSize}
          showing={filteredNodes.length}
          total={systems.length}
          onPartition={setPartition}
          onState={setStateFilter}
          onNodeType={setNodeType}
          onFeatures={(features, logicType) => {
            setSelectedNodeFeatures(features);
            setFeatureLogicType(logicType);
          }}
          onGroupBy={setGroupBy}
          onSize={setCardSize}
        />
        {filteredNodes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No nodes match these filters.
          </div>
        ) : (
          <NodeGroups
            nodes={filteredNodes}
            groupBy={effectiveGroupBy}
            rackConfig={rackConfig ?? undefined}
            size={cardSize}
            colorSchema={colorSchema}
            extras={extrasData?.nodes}
            changed={changed}
            tempWarn={nodeTempWarn}
          />
        )}
      </div>
      {linkedNode && (
        <NodeCardModal
          open
          setOpen={(open) => {
            if (!open) router.replace("/", { scroll: false });
          }}
          nodename={linkedNode}
        />
      )}
    </div>
  );
};

export default Nodes;
