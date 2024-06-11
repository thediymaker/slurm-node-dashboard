"use client";
import { MiniNodeCard } from "./node-card";
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
import { Button } from "../ui/button";
import Link from "next/link";
import JobSearch from "../job-search";

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

const MiniNodes = () => {
  const form = useForm();

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

  const totalNodes = useMemo(() => filteredNodes.length, [filteredNodes]);

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
      <div className="mt-3 justify-between flex ">
      <div className="mr-2">
          <JobSearch />
        </div>
        <Form {...form}>
          <form className="mx-1 mb-4 flex items-center ">
            <div className="flex items-center">
              <div className="mr-2">
                <Button className="px-5" variant={"outline"} asChild>
                  <Link href={"/"}>Detailed Status</Link>
                </Button>
              </div>
              <FormField
                control={form.control}
                name="nodes"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex pr-2">
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleNodeTypeChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Nodes" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="allNodes">All Nodes</SelectItem>
                          <SelectItem value="gpuNodes">GPU Nodes</SelectItem>
                          <SelectItem value="cpuNodes">CPU Nodes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="states"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex pr-2">
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleNodeStateChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All States" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="allState">All States</SelectItem>
                          <SelectItem value="idleState">Idle Nodes</SelectItem>
                          <SelectItem value="mixedState">
                            Mixed Nodes
                          </SelectItem>
                          <SelectItem value="allocState">
                            Allocated Nodes
                          </SelectItem>
                          <SelectItem value="downState">Down Nodes</SelectItem>
                          <SelectItem value="drainState">
                            Draining Nodes
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </div>
      <Separator />
      <div className="flex flex-wrap p-3 uppercase">
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
