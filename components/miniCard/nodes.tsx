"use client";
import { MiniNodeCard } from "./node-card";
import useSWR from "swr";
import { Separator } from "@/components/ui/separator";
import { useMemo, useState } from "react";
import NodeHeader from "../header";

interface Node {
  alloc_memory: number;
  real_memory: number;
  alloc_cpus: number;
  cpus: number;
  gres: string;
  gres_used: string;
  partitions: string[];
  features?: string[];
}

const nodeURL = "/api/slurm/nodes";
const nodeFetcher = () =>
  fetch(nodeURL, {
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => {
    if (!res.ok) {
      throw new Error("Network response was not ok");
    }
    return res.json();
  });

const MiniNodes = () => {
  const {
    data: nodeData,
    error: nodeError,
    isLoading: nodeIsLoading,
  } = useSWR(nodeURL, nodeFetcher, {
    refreshInterval: 30000,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (error.status === 404) return; // Don't retry on 404.
      if (retryCount >= 3) return; // Only retry up to 3 times.
      setTimeout(() => revalidate({ retryCount }), 5000);
    },
  });

  const [selectedNodeType, setSelectedNodeType] = useState<string>("allNodes");
  const [selectedNodeState, setSelectedNodeState] =
    useState<string>("allState");
  const [selectedNodePartitions, setSelectedNodePartitions] =
    useState<string>("allPartitions");
  const [selectedNodeFeature, setSelectedNodeFeature] =
    useState<string>("allFeatures");
  const [dropdownOpenStatus, setDropdownOpenStatus] = useState({}) as any;

  const systems: Node[] = nodeData?.nodes || [];

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
      (node.features || []).forEach((feature) => features.add(feature));
    });
    return Array.from(features);
  }, [systems]);

  const filteredNodes = systems.filter((node: any) => {
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

  function parseGpuInfo(node: Node): { gpuUsed: number; gpuTotal: number } {
    const gpuRegex = /gpu:([^:]+):(\d+)/g; // Capture type and quantity

    const gresMatches = [...node.gres.matchAll(gpuRegex)];
    const gresUsedMatches = [...node.gres_used.matchAll(gpuRegex)];

    const gpuUsed = gresUsedMatches.reduce((acc, match) => {
      const type = match[1];
      const quantity = parseInt(match[2], 10);
      const matchingGres = gresMatches.find((m) => m[1] === type);
      return acc + (matchingGres ? quantity : 0); // Sum only if a match is found
    }, 0);

    const gpuTotal = gresMatches.reduce((acc, match) => {
      return acc + parseInt(match[2], 10);
    }, 0);

    return { gpuUsed, gpuTotal };
  }

  if (nodeError)
    return (
      <div>Failed to load, or session expired, please reload the page.</div>
    );
  if (nodeIsLoading)
    return (
      <div className="font-bold text-2xl uppercase flex justify-center items-center mx-auto pt-20">
        loading...
      </div>
    );

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
      <Separator />
      <div className="flex flex-wrap p-3 uppercase mb-5">
        {filteredNodes.map((node: any, index: number) =>
          node.gres === "" ? (
            <MiniNodeCard
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
              gpuUsed={0}
              gpuTotal={0}
              nodeData={node}
              index={index}
              dropdownOpenStatus={dropdownOpenStatus}
              toggleDropdown={toggleDropdown}
            />
          ) : (
            <MiniNodeCard
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
          )
        )}
      </div>
    </div>
  );
};

export default MiniNodes;
