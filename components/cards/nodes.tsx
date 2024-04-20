"use client";
import { NodeCard } from "./nodeCard";
import useSWR, { mutate } from "swr";
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
import { set, useForm } from "react-hook-form";
import { useMemo, useState } from "react";
import Stats from "./stats";

interface Node {
  alloc_memory: number;
  real_memory: number;
  alloc_cpus: number;
  cpus: number;
  gres: string | null;
  gres_used: string;
}

const url = "/api/slurm/nodes";
const fetcher = () =>
  fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

const Nodes = () => {
  const form = useForm();

  const { data, error, isLoading } = useSWR(url, fetcher, {
    refreshInterval: 10000,
  });
  const [selectedNodeType, setSelectedNodeType] = useState<string>("allNodes");
  const [selectedNodeState, setSelectedNodeState] =
    useState<string>("allState");
  const [dropdownOpenStatus, setDropdownOpenStatus] = useState({}) as any;

  const systems: Node[] = data?.nodes || [];
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

  if (error) return <div>failed to load</div>;
  if (isLoading)
    return (
      <div className="font-bold text-2xl uppercase flex justify-center items-center mx-auto pt-20">
        loading...
      </div>
    );

  return (
    <div>
      <div>
        <Form {...form}>
          <form className="mx-1 mb-4 flex items-center justify-end">
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
                        <SelectItem value="mixedState">Mixed Nodes</SelectItem>
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
          </form>
        </Form>
      </div>
      <Stats data={data} />
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
              gpuUsed={node.gres_used.match(/:(\d+)/)[1]}
              gpuTotal={node.gres.match(/:(\d+)/)[1]}
              index={index}
              data={node}
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
              data={node}
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
