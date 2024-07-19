"use client";
import { NodeCard } from "@/components/ultraCard/node-card";
import useSWR from "swr";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import NodeHeader from "../header";
import CardSkeleton from "../card-skeleton";
import { Node } from "@/utils/nodes";
import { parseGpuInfo } from "@/utils/nodes";
import { Slider } from "../ui/slider";
import { cn } from "@/lib/utils";
import Stats from "./stats";
import { Checkbox } from "../ui/checkbox";
import { Skeleton } from "../ui/skeleton";
import { LastUpdated } from "../last-updated";

// fetch data from the server
const nodeURL = "/api/slurm/nodes";
const nodeFetcher = async () => {
  const res = await fetch(nodeURL, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

//main card component
const UltraNodes = () => {
  const {
    data: nodeData,
    error: nodeError,
    isLoading: nodeIsLoading,
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

  //set states
  const [selectedNodeType, setSelectedNodeType] = useState<string>("allNodes");
  const [selectedNodeState, setSelectedNodeState] =
    useState<string>("allState");
  const [selectedNodePartitions, setSelectedNodePartitions] =
    useState<string>("allPartitions");
  const [selectedNodeFeature, setSelectedNodeFeature] =
    useState<string>("allFeatures");
  const [dropdownOpenStatus, setDropdownOpenStatus] = useState({}) as any;
  const [cardSize, setCardSize] = useState<number>(getInitialCardSize);
  const [showStats, setShowStats] = useState<boolean>(getInitialShowStats);
  const systems: Node[] = nodeData?.nodes || [];

  useEffect(() => {
    localStorage.setItem("cardSize", cardSize.toString());
  }, [cardSize]);

  useEffect(() => {
    localStorage.setItem("showStats", showStats.toString());
  }, [showStats]);

  //get unique partitions
  const uniquePartitions = useMemo(() => {
    const partitions = new Set<string>();
    systems.forEach((node) => {
      node.partitions.forEach((partition) => partitions.add(partition));
    });
    return Array.from(partitions);
  }, [systems]);

  //get unique features
  const uniqueFeatures = useMemo(() => {
    const features = new Set<string>();
    systems.forEach((node) => {
      (node.features || []).forEach((feature) => features.add(feature));
    });
    return Array.from(features);
  }, [systems]);

  //filter nodes
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

      const nodeMatchesFeature =
        selectedNodeFeature === "allFeatures" ||
        (node.features || []).includes(selectedNodeFeature);

      return (
        nodeMatchesType &&
        nodeMatchesState &&
        nodeMatchesPartitions &&
        nodeMatchesFeature
      );
    });
  }, [
    systems,
    selectedNodeType,
    selectedNodeState,
    selectedNodePartitions,
    selectedNodeFeature,
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

  const handleNodeFeatureChange = (value: string) => {
    setSelectedNodeFeature(value);
  };

  const toggleDropdown = (index: any) => {
    setDropdownOpenStatus((prevState: any) => ({
      ...prevState,
      [index]: !prevState[index],
    }));
  };

  if (nodeError) {
    return (
      <div>
        {nodeError.message === "Network response was not ok"
          ? "Failed to load, please check your network connection."
          : "Session expired, please reload the page."}
      </div>
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
          partitions={uniquePartitions}
          features={uniqueFeatures}
        />
        <div className="flex justify-between">
          <div className="flex justify-start w-full mb-4 pl-2 gap-4 items-center">
            <div className="font-extralight">Card Size</div>
            <Slider className="w-[100px]" />
            <div className="font-extralight">Show Detail</div>
            <Checkbox defaultChecked={showStats} />
          </div>
          <div className="flex justify-end w-full mb-4 gap-2 items-center">
            <div className="flex items-center gap-2 font-extralight">
              GPU Nodes
              <Skeleton className="w-[20px]" />
            </div>
            <div className="flex items-center gap-2 font-extralight">
              CPU Nodes
              <Skeleton className="w-[20px]" />
            </div>
          </div>
        </div>
        <Separator />
        <CardSkeleton qty={100} size={100} />
      </div>
    );
  }

  return (
    <div>
      <NodeHeader
        handleNodeStateChange={handleNodeStateChange}
        handleNodeTypeChange={handleNodeTypeChange}
        handleNodePartitionsChange={handleNodePartitionsChange}
        handleNodeFeatureChange={handleNodeFeatureChange}
        partitions={uniquePartitions}
        features={uniqueFeatures} // Pass unique features to the header
      />
      <div className="flex justify-between">
        <div className="flex justify-start w-full mb-4 pl-2 gap-4 items-center">
          <div className="font-extralight">Card Size</div>
          <Slider
            className="w-[100px]"
            value={[cardSize]} // Change from defaultValue to value if the component supports controlled mode
            min={50}
            max={150}
            step={50}
            onValueChange={(values) => setCardSize(values[0])}
          />
          <div className="font-extralight">Show Detail</div>
          <Checkbox
            defaultChecked={showStats}
            onCheckedChange={() => {
              setShowStats(!showStats);
            }}
          />
        </div>
        <div className="flex justify-end w-full mb-4 gap-2 items-center">
          <div className="flex items-center gap-2 font-extralight">
            GPU Nodes
            <span className="text-blue-400">{totalGpuNodes}</span>
          </div>
          <div className="flex items-center gap-2 font-extralight">
            CPU Nodes
            <span className="text-blue-400">{totalCpuNodes}</span>
          </div>
        </div>
      </div>
      {showStats ? <Stats data={nodeData} /> : null}
      <Separator />
      <div className="flex flex-wrap p-3 uppercase mb-20">
        {filteredNodes.map((node: any, index: number) => (
          <NodeCard
            size={cardSize} // Pass the card size based on the checkbox state
            key={node.hostname}
            name={node.name}
            load={node.cpu_load.number}
            partitions={node.partitions}
            features={node.features}
            coresTotal={node.cpus}
            coresUsed={node.alloc_cpus}
            memoryTotal={node.real_memory}
            memoryUsed={node.alloc_memory}
            status={node.state}
            gpuUsed={parseGpuInfo(node).gpuUsed}
            gpuTotal={parseGpuInfo(node).gpuTotal}
            index={index}
            nodeData={node}
            dropdownOpenStatus={dropdownOpenStatus}
            toggleDropdown={toggleDropdown}
          />
        ))}
      </div>
      <LastUpdated data={nodeData?.last_update.number} />
    </div>
  );
};

export default UltraNodes;
