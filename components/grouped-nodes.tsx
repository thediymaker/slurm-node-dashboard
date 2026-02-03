import { useEffect, useState, useMemo, useCallback, memo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GroupedNodesProps {
  nodes: Node[];
  cardSize: number;
  colorSchema: string;
}

interface StatusBadgeProps {
  count: number;
  type: "idle" | "allocated" | "mixed" | "drain" | "down";
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

// Pure function - moved outside component
const expandNodeRange = (nodeRange: string): string[] => {
  if (!nodeRange.includes("..")) return [nodeRange];

  const [prefix, rangeEnd] = nodeRange.split("..");

  const startNumMatch = prefix.match(/(\d+)$/);
  if (!startNumMatch) return [nodeRange];
  const startNumStr = startNumMatch[1];
  const startNum = parseInt(startNumStr, 10);
  const endNum = parseInt(rangeEnd, 10);
  if (isNaN(endNum)) return [nodeRange];

  const basePrefix = prefix.slice(0, prefix.length - startNumStr.length);
  const padLength = startNumStr.length;

  const expandedNodes: string[] = [];
  for (let i = startNum; i <= endNum; i++) {
    expandedNodes.push(
      `${basePrefix}${i.toString().padStart(padLength, "0")}`
    );
  }
  return expandedNodes;
};

// Pure function - moved outside component
const isNodeInAnyRack = (nodeName: string, config: NodeConfig): boolean => {
  return Object.values(config).some(({ nodes: groupNodes }) =>
    groupNodes.some((rackNodeRange) => {
      if (!rackNodeRange.includes("..")) {
        return nodeName === rackNodeRange;
      }
      const expandedNodes = expandNodeRange(rackNodeRange);
      return expandedNodes.includes(nodeName);
    })
  );
};

const getStatusColor = (type: string, colorSchema: string = "default") => {
  const colorMap: { [key: string]: { [key: string]: string } } = {
    default: {
      idle: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400",
      allocated: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
      mixed:
        "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
      drain: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
      down: "bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400",
    },
    neon: {
      idle: "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
      allocated:
        "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400",
      mixed:
        "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
      drain:
        "bg-fuchsia-100 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
      down: "bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400",
    },
    nordic: {
      idle: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      allocated:
        "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
      mixed:
        "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
      drain: "bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400",
      down: "bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400",
    },
    candy: {
      idle: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400",
      allocated: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
      mixed:
        "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
      drain: "bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400",
      down: "bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400",
    },
    desert: {
      idle: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
      allocated:
        "bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
      mixed: "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400",
      drain:
        "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
      down: "bg-stone-100 dark:bg-stone-500/10 text-stone-700 dark:text-stone-400",
    },
    ocean: {
      idle: "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
      allocated:
        "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
      mixed: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
      drain: "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
      down: "bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400",
    },
  };

  return colorMap[colorSchema]?.[type] || colorMap.default[type];
};

// Memoized StatusBadge component
const StatusBadge = memo(({
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
});
StatusBadge.displayName = "StatusBadge";

// Loading skeleton for groups
const GroupSkeleton = () => (
  <div className="border rounded-lg p-3 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-8" />
        <Skeleton className="h-5 w-8" />
        <Skeleton className="h-5 w-8" />
      </div>
    </div>
  </div>
);

const GroupedNodes: React.FC<GroupedNodesProps> = ({
  nodes,
  cardSize,
  colorSchema,
}) => {
  const [config, setConfig] = useState<NodeConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("openNodeSections");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Persist open sections to localStorage
  useEffect(() => {
    localStorage.setItem("openNodeSections", JSON.stringify(openSections));
  }, [openSections]);

  // Create a hostname -> node lookup map for O(1) access instead of O(n) filtering
  const nodesByHostname = useMemo(() => {
    const map = new Map<string, any>();
    nodes.forEach((node: any) => {
      if (node.hostname) {
        map.set(node.hostname, node);
      }
    });
    return map;
  }, [nodes]);

  // Memoized function to get node data - uses the lookup map
  const getNodeData = useCallback((nodeName: string): any[] => {
    const expandedNodes = expandNodeRange(nodeName);
    return expandedNodes
      .map((name) => nodesByHostname.get(name))
      .filter((node): node is any => node !== undefined);
  }, [nodesByHostname]);

  // Helper to normalize state for stats calculation
  const normalizeState = useCallback((state: string[] | string): string[] => {
    if (Array.isArray(state)) {
      return state.map(s => s.toUpperCase().trim());
    } else if (typeof state === "string") {
      return state.split(/[+\s]+/).filter(Boolean).map(s => s.toUpperCase().trim());
    }
    return ["UNKNOWN"];
  }, []);

  // Compute "Other" nodes (not in any rack) - this updates when nodes change
  const configWithOther = useMemo(() => {
    if (Object.keys(config).length === 0) {
      // No config loaded yet, or error - show all nodes as Uncategorized
      if (!isLoading && nodes.length > 0) {
        return {
          Uncategorized: {
            nodes: nodes.map((node: any) => node.hostname).filter(Boolean),
            description: "All nodes",
          },
        };
      }
      return config;
    }

    const otherNodes = nodes
      .filter((node: any) => !isNodeInAnyRack(node.hostname || "", config))
      .map((node: any) => node.hostname)
      .filter(Boolean);

    if (otherNodes.length > 0) {
      return {
        ...config,
        Other: {
          nodes: otherNodes,
          description: "Nodes not assigned to any rack",
        },
      };
    }

    return config;
  }, [config, nodes, isLoading]);

  // Memoize group stats calculation - now uses configWithOther to include "Other" group
  const groupStats = useMemo(() => {
    const statsMap = new Map<string, { total: number; allocated: number; idle: number; mixed: number; drain: number; down: number }>();

    Object.entries(configWithOther).forEach(([group, { nodes: groupNodes }]) => {
      const stats = { total: 0, allocated: 0, idle: 0, mixed: 0, drain: 0, down: 0 };

      groupNodes.forEach((nodeName: string) => {
        const nodeDataArray = getNodeData(nodeName);
        nodeDataArray.forEach((node) => {
          stats.total++;
          const stateArray = normalizeState(node.state);
          const stateStr = stateArray.join(" ");

          if (stateStr.includes("DOWN")) {
            stats.down++;
          } else if (stateStr.includes("DRAIN")) {
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

      statsMap.set(group, stats);
    });

    return statsMap;
  }, [configWithOther, getNodeData, normalizeState]);

  // Expand/collapse all handlers
  const handleExpandAll = useCallback(() => {
    setOpenSections(Object.keys(config));
  }, [config]);

  const handleCollapseAll = useCallback(() => {
    setOpenSections([]);
  }, []);

  // Load configuration ONCE on mount - not on every nodes change
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/node-config");
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setConfig({});
          return;
        }

        setConfig(data);
      } catch (err) {
        setError("Unable to load node configuration");
        setConfig({});
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []); // Empty dependency - load once on mount

  const configEntries = Object.entries(configWithOther);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="bg-destructive/5 border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Expand/Collapse controls */}
      {!isLoading && configEntries.length > 1 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="text-xs h-7"
          >
            <ChevronsUpDown className="h-3 w-3 mr-1" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapseAll}
            className="text-xs h-7"
          >
            <ChevronsDownUp className="h-3 w-3 mr-1" />
            Collapse All
          </Button>
        </div>
      )}

      <div className="space-y-2 mt-4 mb-24">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <GroupSkeleton key={i} />
            ))}
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-2"
          >
            {configEntries.map(
              ([group, { nodes: groupNodes, description }]) => {
                const stats = groupStats.get(group) || { total: 0, allocated: 0, idle: 0, mixed: 0, drain: 0, down: 0 };

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
                          <StatusBadge
                            count={stats.down}
                            type="down"
                            colorSchema={colorSchema}
                          />
                          <Badge variant="outline" className="ml-2 py-0.5 px-1.5">
                            {stats.total}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap p-3 uppercase">
                        {groupNodes.flatMap((nodeName: string) => {
                          const expandedNames = expandNodeRange(nodeName);
                          return expandedNames.map((hostname) => {
                            const node = nodesByHostname.get(hostname);
                            if (!node) return null;
                            return (
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
                            );
                          });
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }
            )}
          </Accordion>
        )}
      </div>
    </div>
  );
};

export default memo(GroupedNodes);
