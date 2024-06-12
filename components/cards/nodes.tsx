"use client";
import { NodeCard } from "./node-card";
import useSWR from "swr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useMemo, useState } from "react";
import Stats from "./stats";
import { Button } from "../ui/button";
import Link from "next/link";
import JobSearch from "../job-search";
import NodeHeader from "../header";

interface Node {
  alloc_memory: number;
  real_memory: number;
  alloc_cpus: number;
  cpus: number;
  gres: string;
  gres_used: string;
}

const nodeURL = "/api/slurm/nodes";
const nodeFetcher = () =>
  fetch(nodeURL, {
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

const Nodes = () => {

  const {
    data: nodeData,
    error: nodeError,
    isLoading: nodeIsLoading,
  } = useSWR(nodeURL, nodeFetcher, {
    refreshInterval: 5000,
  });

  const [selectedNodeType, setSelectedNodeType] = useState<string>("allNodes");
  const [selectedNodeState, setSelectedNodeState] =
    useState<string>("allState");
  const [dropdownOpenStatus, setDropdownOpenStatus] = useState({}) as any;

  const systems: Node[] = nodeData?.nodes || [];
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

    return nodeMatchesType && nodeMatchesState;
  });

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

  // This function handles the change event for the node state selection menu
  const handleNodeStateChange = (value: string) => {
    setSelectedNodeState(value);
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
      />
      <Stats data={nodeData} />
      <div className="text-xl font-bold uppercase p-3">
        GPU Systems : <span className="text-blue-400">{totalGpuNodes}</span>
      </div>
      <Separator />
      <div className="flex flex-wrap p-3 uppercase">
        {filteredNodes.map((node: any, index: number) =>
          node.gres === "" ? null : (
            <NodeCard
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
      <div className="text-xl font-bold uppercase p-5">
        CPU Systems : <span className="text-blue-400">{totalCpuNodes}</span>
      </div>
      <Separator />
      <div className="flex flex-wrap p-3 uppercase">
        {filteredNodes.map((node: any, index: number) =>
          node.gres !== "" ? null : (
            <NodeCard
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
          )
        )}
      </div>
    </div>
  );
};

export default Nodes;
