import { useEffect, useState } from "react";
import { NodeCard } from "./nodeCard/node-card";
import type { Node, NodeConfig } from "@/types/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface GroupedNodesProps {
  nodes: Node[];
  cardSize: number;
  colorSchema: string;
}

interface StatusBadgeProps {
  count: number;
  type: "idle" | "allocated" | "mixed" | "drain";
  colorSchema?: string;
  className?: string;
}

interface ExtendedNode extends Node {
  name?: string;
  hostname?: string;
  cpu_load?: {
    number: number;
  };
  state: string[];
}

const getStatusColor = (type: string, colorSchema: string = "default") => {
  const colorMap: { [key: string]: { [key: string]: string } } = {
    default: {
      idle: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400",
      allocated: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
      mixed:
        "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
      drain: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
    },
    neon: {
      idle: "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
      allocated:
        "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400",
      mixed:
        "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
      drain:
        "bg-fuchsia-100 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
    },
    nordic: {
      idle: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      allocated:
        "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
      mixed:
        "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
      drain: "bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400",
    },
    candy: {
      idle: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400",
      allocated: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
      mixed:
        "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
      drain: "bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400",
    },
    desert: {
      idle: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
      allocated:
        "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
      mixed: "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400",
      drain:
        "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
    },
    ocean: {
      idle: "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
      allocated:
        "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
      mixed: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
      drain: "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
  };

  return colorMap[colorSchema]?.[type] || colorMap.default[type];
};

const StatusBadge = ({
  count,
  type,
  colorSchema = "default",
  className,
}: StatusBadgeProps) => {
  const baseStyles =
    "inline-flex items-center text-xs px-1.5 py-0.5 font-medium";

  if (count === 0) return null;

  return (
    <Badge
      variant="secondary"
      className={cn(baseStyles, getStatusColor(type, colorSchema), className)}
    >
      {count}
    </Badge>
  );
};

const isNodeInAnyRack = (nodeName: string, config: NodeConfig): boolean => {
  return Object.values(config).some(({ nodes: groupNodes }) =>
    groupNodes.some((rackNodeRange) => {
      if (!rackNodeRange.includes("-")) {
        return nodeName === rackNodeRange;
      }

      const [prefix, suffix] = rackNodeRange.split("-");
      const nodeMatch = nodeName.match(/^([a-z]+)(\d+)([a-z]*)$/i);
      if (!nodeMatch) return false;

      const [, nodePrefix, nodeNumStr, nodeSuffix] = nodeMatch;
      const nodeNumber = parseInt(nodeNumStr);

      const prefixMatch = prefix.match(/^([a-z]+)(\d+)([a-z]*)$/i);
      if (!prefixMatch) return false;

      const [, rackPrefix, startNumStr, rackSuffix] = prefixMatch;
      const startNumber = parseInt(startNumStr);
      const endNumber = parseInt(suffix);

      return (
        nodePrefix === rackPrefix &&
        nodeSuffix === rackSuffix &&
        nodeNumber >= startNumber &&
        nodeNumber <= endNumber
      );
    })
  );
};

const GroupedNodes: React.FC<GroupedNodesProps> = ({
  nodes,
  cardSize,
  colorSchema,
}) => {
  const [config, setConfig] = useState<NodeConfig>({});
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("openNodeSections");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("openNodeSections", JSON.stringify(openSections));
  }, [openSections]);

  const expandNodeRange = (nodeRange: string): string[] => {
    if (!nodeRange.includes("-")) return [nodeRange];

    const [prefix, rangeEnd] = nodeRange.split("-");
    const basePrefix = prefix.replace(/\d+$/, "");
    const startNum = parseInt(prefix.match(/\d+$/)?.[0] || "0");
    const endNum = parseInt(rangeEnd);

    const expandedNodes = [];
    for (let i = startNum; i <= endNum; i++) {
      expandedNodes.push(`${basePrefix}${i.toString().padStart(3, "0")}`);
    }
    return expandedNodes;
  };

  const getNodeData = (nodeName: string): any[] => {
    const expandedNodes = expandNodeRange(nodeName);
    return nodes
      .filter((node): node is any =>
        expandedNodes.some((name) => (node as ExtendedNode).hostname === name)
      )
      .map((node) => {
        const rawState = node.state;
        const stateArray = Array.isArray(rawState)
          ? rawState
          : typeof rawState === "string"
          ? rawState.split(/[+\s]+/).filter(Boolean)
          : ["UNKNOWN"];

        return {
          ...node,
          state: stateArray.map((s) => s.toUpperCase().trim()),
        };
      });
  };

  const getGroupStats = (groupNodes: string[]) => {
    const stats = {
      total: 0,
      allocated: 0,
      idle: 0,
      mixed: 0,
      drain: 0,
    };

    groupNodes.forEach((nodeName) => {
      const nodeDataArray = getNodeData(nodeName);
      nodeDataArray.forEach((node) => {
        stats.total++;
        const nodeStates = node.state;
        const stateStr = nodeStates.join(" ").toUpperCase();

        if (stateStr.includes("DRAIN")) {
          stats.drain++;
        } else if (stateStr.includes("MIXED")) {
          stats.mixed++;
        } else if (stateStr.includes("ALLOCATED")) {
          stats.allocated++;
        } else if (stateStr.includes("IDLE")) {
          stats.idle++;
        }
      });
    });

    return stats;
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/node-config");
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          // Create a default configuration with all nodes in "Uncategorized"
          const defaultConfig: NodeConfig = {
            Uncategorized: {
              nodes: nodes
                .map((node) => (node as ExtendedNode).hostname)
                .filter((hostname): hostname is string => Boolean(hostname)),
              description: "All nodes (configuration unavailable)",
            },
          };
          setConfig(defaultConfig);
          return;
        }

        // Process valid configuration
        const otherNodes = nodes
          .filter(
            (node) =>
              !isNodeInAnyRack((node as ExtendedNode).hostname || "", data)
          )
          .map((node) => (node as ExtendedNode).hostname)
          .filter((hostname): hostname is string => Boolean(hostname));

        if (otherNodes.length > 0) {
          data["Other"] = {
            nodes: otherNodes,
            description: "Nodes not assigned to any rack",
          };
        }

        setConfig(data);
      } catch (error) {
        setError("Unable to load node configuration");
        const defaultConfig: NodeConfig = {
          Uncategorized: {
            nodes: nodes
              .map((node) => (node as ExtendedNode).hostname)
              .filter((hostname): hostname is string => Boolean(hostname)),
            description: "All nodes (configuration unavailable)",
          },
        };
        setConfig(defaultConfig);
      }
    };

    loadConfig();
  }, [nodes]);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="bg-destructive/5 border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2 mt-4 mb-24">
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="space-y-2"
        >
          {Object.entries(config).map(
            ([group, { nodes: groupNodes, description }]) => {
              const stats = getGroupStats(groupNodes);

              return (
                <AccordionItem
                  key={group}
                  value={group}
                  className="border rounded-lg shadow-sm data-[state=open]:shadow-md transition-shadow duration-200"
                >
                  <AccordionTrigger className="px-3 py-2 hover:no-underline [&[data-state=open]]:bg-accent/40 rounded-t-lg">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{group}</span>
                        {description && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            • {description}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 items-center text-xs">
                        <StatusBadge
                          count={stats.idle}
                          type="idle"
                          colorSchema={colorSchema}
                        />
                        <StatusBadge
                          count={stats.allocated}
                          type="allocated"
                          colorSchema={colorSchema}
                        />
                        <StatusBadge
                          count={stats.mixed}
                          type="mixed"
                          colorSchema={colorSchema}
                        />
                        <StatusBadge
                          count={stats.drain}
                          type="drain"
                          colorSchema={colorSchema}
                        />
                        <Badge variant="outline" className="ml-2 py-0.5 px-1.5">
                          {stats.total}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-2">
                      {description && (
                        <p className="text-xs text-muted-foreground mb-2 sm:hidden">
                          {description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {groupNodes.map((nodeName) => {
                          const nodesData = getNodeData(nodeName);
                          return nodesData.map((nodeData) => (
                            <NodeCard
                              size={cardSize}
                              key={nodeData.hostname}
                              name={nodeData.name}
                              load={nodeData.cpu_load?.number}
                              partitions={nodeData.partitions}
                              features={nodeData.features}
                              coresTotal={nodeData.cpus}
                              coresUsed={nodeData.alloc_cpus}
                              memoryTotal={nodeData.real_memory}
                              memoryUsed={nodeData.alloc_memory}
                              status={nodeData.state}
                              nodeData={nodeData}
                              colorSchema={colorSchema}
                            />
                          ));
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            }
          )}
        </Accordion>
      </div>
    </div>
  );
};

export default GroupedNodes;
