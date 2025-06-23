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

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";;
const nodeURL = `${baseURL}/api/slurm/nodes`;
const nodeFetcher = async () => {
  const res = await fetch(nodeURL, {
    headers: {
      "Content-Type": "application/json",
    },
    next: { revalidate: 15 },
  });
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

const Nodes = () => {
  const {
    data: nodeData,
    error: nodeError,
    isLoading: nodeIsLoading,
    mutate,
  } = useSWR(nodeURL, nodeFetcher, {
    refreshInterval: 15000,
  });

  const getInitialCardSize = () => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("cardSize") || "100", 10);
    }
    return 100;
  };

  const getInitialShowStats = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showStats") === "true";
    }
    return false;
  };

  const getInitialColorSchema = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("colorSchema") || "default";
    }
    return "default";
  };

  const getInitialViewMode = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("isGroupedView") === "true";
    }
    return false;
  };

  const getInitialSelectedFeatures = () => {
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
  };

  const getInitialFeatureLogicType = () => {
    if (typeof window !== "undefined") {
      const logicType = localStorage.getItem("featureLogicType") as LogicType;
      return logicType === "OR" ? "OR" : "AND";
    }
    return "AND";
  };

  const [selectedNodeType, setSelectedNodeType] = useState<string>("allNodes");
  const [selectedNodeState, setSelectedNodeState] =
    useState<string>("allState");
  const [selectedNodePartitions, setSelectedNodePartitions] =
    useState<string>("allPartitions");
  const [selectedNodeFeatures, setSelectedNodeFeatures] = useState<string[]>(
    getInitialSelectedFeatures
  );
  const [featureLogicType, setFeatureLogicType] = useState<LogicType>(
    getInitialFeatureLogicType
  );
  const [cardSize, setCardSize] = useState<number>(getInitialCardSize);
  const [showStats, setShowStats] = useState<boolean>(getInitialShowStats);
  const [colorSchema, setColorSchema] = useState<string>(getInitialColorSchema);
  const [isGroupedView, setIsGroupedView] =
    useState<boolean>(getInitialViewMode);

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

  // Set up polling for data updates
  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
    }, 15000);

    return () => clearInterval(interval);
  }, [mutate]);

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

  if (nodeError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {nodeError.message === "Network response was not ok"
            ? "Failed to load, please check your network connection."
            : "Session expired, please reload the page."}
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
      )}
      <LastUpdated data={nodeData?.last_update?.number} />
      {openaiPluginMetadata.isEnabled && <ChatIcon />}
    </div>
  );
};

export default Nodes;
