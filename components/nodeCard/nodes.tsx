"use client";

import { NodeCard } from "@/components/nodeCard/node-card";
import GroupedNodes from "@/components/grouped-nodes";
import useSWR from "swr";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import NodeHeader from "./node-header";
import CardSkeleton from "./card-skeleton";
import { Slider } from "../ui/slider";
import Stats from "./stats";
import { Checkbox } from "../ui/checkbox";
import { Skeleton } from "../ui/skeleton";
import { LastUpdated } from "../last-updated";
import { Node } from "@/types/types";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import NodeCount from "./node-counts";
import ChatIcon from "../llm/chat-icon";
import { openaiPluginMetadata } from "@/actions/plugins";
import { LogicType } from "@/components/feature-selector";
import NodeGameWrapper from "./node-game-wrapper";

const nodeURL = "/api/slurm/nodes";
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

const Nodes = ({ username }: { username?: string }) => {
  // Track connection errors that occur during revalidation
  const [lastFetchError, setLastFetchError] = useState<Error | null>(null);

  const {
    data: nodeData,
    error: nodeError,
    isLoading: nodeIsLoading,
  } = useSWR(nodeURL, nodeFetcher, {
    refreshInterval: 15000,
    onSuccess: () => {
      // Clear error on success
      setLastFetchError(null);
    },
    onError: (err) => {
      // Track errors even when we have cached data
      setLastFetchError(err);
    },
  });

  // Determine if we have a connection issue (either initial error or revalidation error)
  const hasConnectionError = !!(nodeError || (lastFetchError && nodeData));

  // Use lazy initializers - function is only called once on mount
  const [cardSize, setCardSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("cardSize") || "100", 10);
    }
    return 100;
  });

  const [showStats, setShowStats] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showStats") === "true";
    }
    return false;
  });

  const [colorSchema, setColorSchema] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("colorSchema") || "default";
    }
    return "default";
  });

  const [isGroupedView, setIsGroupedView] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("isGroupedView") === "true";
    }
    return false;
  });

  const [selectedNodeFeatures, setSelectedNodeFeatures] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const storedFeatures = localStorage.getItem("selectedNodeFeatures");
      if (storedFeatures) {
        try {
          return JSON.parse(storedFeatures);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const [featureLogicType, setFeatureLogicType] = useState<LogicType>(() => {
    if (typeof window !== "undefined") {
      const logicType = localStorage.getItem("featureLogicType") as LogicType;
      return logicType === "OR" ? "OR" : "AND";
    }
    return "AND";
  });

  const [selectedNodeType, setSelectedNodeType] = useState<string>("allNodes");
  const [selectedNodeState, setSelectedNodeState] =
    useState<string>("allState");
  const [selectedNodePartitions, setSelectedNodePartitions] =
    useState<string>("allPartitions");
  const [showGame, setShowGame] = useState(false);

  const systems: Node[] = nodeData?.nodes || [];

  useEffect(() => {
    localStorage.setItem("cardSize", cardSize.toString());
  }, [cardSize]);

  useEffect(() => {
    localStorage.setItem("showStats", showStats.toString());
  }, [showStats]);

  useEffect(() => {
    localStorage.setItem("colorSchema", colorSchema);
  }, [colorSchema]);

  useEffect(() => {
    localStorage.setItem("isGroupedView", isGroupedView.toString());
  }, [isGroupedView]);

  useEffect(() => {
    localStorage.setItem(
      "selectedNodeFeatures",
      JSON.stringify(selectedNodeFeatures)
    );
  }, [selectedNodeFeatures]);

  useEffect(() => {
    localStorage.setItem("featureLogicType", featureLogicType);
  }, [featureLogicType]);

  // SWR handles polling via refreshInterval - no manual interval needed

  const uniquePartitions = useMemo(() => {
    const partitions = new Set<string>();
    systems.forEach((node) => {
      node.partitions.forEach((partition) => partitions.add(partition));
    });
    return Array.from(partitions);
  }, [systems]);

  const uniqueFeatures = useMemo(() => {
    const features = new Set<string>();
    systems.forEach((node) => {
      if (node.features && Array.isArray(node.features)) {
        node.features.forEach((feature) => {
          if (feature) features.add(feature);
        });
      }
    });
    return Array.from(features);
  }, [systems]);

  const filteredNodes = useMemo(() => {
    return systems.filter((node: any) => {
      const nodeMatchesType =
        selectedNodeType === "allNodes" ||
        (selectedNodeType === "gpuNodes" && node.gres !== "") ||
        (selectedNodeType === "cpuNodes" && node.gres === "");

      const nodeMatchesState =
        selectedNodeState === "allState" ||
        (selectedNodeState === "idleState" && node.state[0] === "IDLE") ||
        (selectedNodeState === "mixedState" && node.state[0] === "MIXED") ||
        (selectedNodeState === "allocState" && node.state[0] === "ALLOCATED") ||
        (selectedNodeState === "downState" && node.state[0] === "DOWN") ||
        (selectedNodeState === "drainState" && node.state[1] === "DRAIN");

      const nodeMatchesPartitions =
        selectedNodePartitions === "allPartitions" ||
        node.partitions.includes(selectedNodePartitions);

      // Check if node has features based on selected logic type
      let nodeMatchesFeatures = true;
      if (selectedNodeFeatures && selectedNodeFeatures.length > 0) {
        if (featureLogicType === "AND") {
          // Node must have ALL selected features
          nodeMatchesFeatures = selectedNodeFeatures.every(
            (feature) =>
              node.features &&
              Array.isArray(node.features) &&
              node.features.includes(feature)
          );
        } else {
          // Node must have AT LEAST ONE of the selected features (OR logic)
          nodeMatchesFeatures = selectedNodeFeatures.some(
            (feature) =>
              node.features &&
              Array.isArray(node.features) &&
              node.features.includes(feature)
          );
        }
      }

      return (
        nodeMatchesType &&
        nodeMatchesState &&
        nodeMatchesPartitions &&
        nodeMatchesFeatures
      );
    });
  }, [
    systems,
    selectedNodeType,
    selectedNodeState,
    selectedNodePartitions,
    selectedNodeFeatures,
    featureLogicType,
  ]);

  const totalCpuNodes = useMemo(
    () => systems.filter((node) => !node.gres).length,
    [systems]
  );
  const totalGpuNodes = useMemo(
    () => systems.filter((node) => node.gres).length,
    [systems]
  );

  const handleNodeTypeChange = (value: string) => {
    setSelectedNodeType(value);
  };

  const handleNodeStateChange = (value: string) => {
    setSelectedNodeState(value);
  };

  const handleNodePartitionsChange = (value: string) => {
    setSelectedNodePartitions(value);
  };

  const handleNodeFeatureChange = (
    features: string[],
    logicType: LogicType
  ) => {
    setSelectedNodeFeatures(features);
    setFeatureLogicType(logicType);
  };

  const handleColorSchemaChange = (value: string) => {
    setColorSchema(value);
  };

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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {errorMessage}
        </AlertDescription>
      </Alert>
    );
  }

  if (nodeIsLoading) {
    return (
      <div>
        <NodeHeader
          handleNodeStateChange={handleNodeStateChange}
          handleNodeTypeChange={handleNodeTypeChange}
          handleNodePartitionsChange={handleNodePartitionsChange}
          handleNodeFeatureChange={handleNodeFeatureChange}
          handleColorSchemaChange={handleColorSchemaChange}
          handleViewModeChange={setIsGroupedView}
          isGroupedView={isGroupedView}
          partitions={[]}
          features={[]}
          colorSchema={colorSchema}
          username={username}
        />
        <div className="flex justify-between">
          <div className="flex justify-start w-full mb-4 pl-2 gap-4 items-center">
            <div className="font-extralight">Card Size</div>
            <Slider className="w-[100px]" />
            <div className="font-extralight">Show Detail</div>
            <Skeleton className="w-6 h-6" />
          </div>
          <div className="flex justify-end w-full mb-4 gap-2 items-center">
            <div className="flex items-center gap-2 font-extralight">
              <Skeleton className="w-[120px] h-[30px]" />
            </div>
            <div className="flex items-center gap-2 font-extralight">
              <Skeleton className="w-[120px] h-[30px]" />
            </div>
            <div className="flex items-center gap-2 font-extralight">
              <Skeleton className="w-[150px] h-[30px]" />
            </div>
          </div>
        </div>
        <Separator />
        <CardSkeleton qty={300} size={85} />
      </div>
    );
  }

  return (
    <div className="mr-2">
      <NodeHeader
        handleNodeStateChange={handleNodeStateChange}
        handleNodeTypeChange={handleNodeTypeChange}
        handleNodePartitionsChange={handleNodePartitionsChange}
        handleNodeFeatureChange={handleNodeFeatureChange}
        handleColorSchemaChange={handleColorSchemaChange}
        handleViewModeChange={setIsGroupedView}
        isGroupedView={isGroupedView}
        partitions={uniquePartitions}
        features={uniqueFeatures}
        colorSchema={colorSchema}
        selectedFeatures={selectedNodeFeatures}
        featureLogicType={featureLogicType}
        username={username}
      />
      <div className="flex justify-between">
        <div className="flex justify-start w-full mb-4 pl-2 gap-4 items-center">
          <div className="font-extralight">Card Size</div>
          <Slider
            className="w-[100px]"
            value={[cardSize]}
            min={50}
            max={150}
            step={50}
            onValueChange={(values) => setCardSize(values[0])}
          />
          <div className="font-extralight">Show Detail</div>
          <Checkbox
            checked={showStats}
            onCheckedChange={(checked) => {
              setShowStats(checked as boolean);
            }}
          />
        </div>
        <NodeCount
          totalGpuNodes={totalGpuNodes}
          totalCpuNodes={totalCpuNodes}
          filteredNodes={filteredNodes.length}
          totalNodes={systems.length}
        />
      </div>
      {showStats && nodeData ? (
        <Stats data={nodeData} colorSchema={colorSchema} />
      ) : null}
      <Separator />

      {isGroupedView ? (
        <GroupedNodes
          nodes={filteredNodes}
          cardSize={cardSize}
          colorSchema={colorSchema}
        />
      ) : (
        <NodeGameWrapper
          nodes={filteredNodes}
          isGameActive={showGame}
          onGameEnd={() => setShowGame(false)}
        >
          <div className="flex flex-wrap p-3 uppercase mb-20">
            {filteredNodes.map((node: any) => (
              <NodeCard
                size={cardSize}
                key={node.hostname}
                name={node.name}
                load={node.cpu_load?.number}
                partitions={node.partitions}
                features={node.features}
                coresTotal={node.cpus}
                coresUsed={node.alloc_cpus}
                memoryTotal={node.real_memory}
                memoryUsed={node.alloc_memory}
                status={node.state}
                nodeData={node}
                colorSchema={colorSchema}
              />
            ))}
          </div>
        </NodeGameWrapper>
      )}
      <LastUpdated 
        data={nodeData?.last_update?.number} 
        onEasterEgg={() => !isGroupedView && setShowGame(true)}
        hasConnectionError={hasConnectionError}
      />
      {openaiPluginMetadata.isEnabled && <ChatIcon />}
    </div>
  );
};

export default Nodes;
