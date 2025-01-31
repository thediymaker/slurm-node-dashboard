import { NodeConfig } from "@/types/types";

// utils/node-range.ts
export const expandNodeRange = (range: string): string[] => {
  const matches = range.match(/^(.*?)(\d+)-(\d+)$/);
  if (!matches) return [range];

  const [, prefix, start, end] = matches;
  const startNum = parseInt(start, 10);
  const endNum = parseInt(end, 10);
  const padding = start.length;

  return Array.from(
    { length: endNum - startNum + 1 },
    (_, i) => `${prefix}${(startNum + i).toString().padStart(padding, "0")}`
  );
};

export const parseNodeConfig = async (): Promise<NodeConfig> => {
  try {
    const response = await fetch("/api/node-config");
    const config = await response.json();

    // Process each group's nodes to expand ranges
    const expandedConfig: NodeConfig = {};

    for (const [group, data] of Object.entries<any>(config)) {
      const expandedNodes: string[] = [];

      for (const node of data.nodes) {
        if (typeof node === "string") {
          expandedNodes.push(...expandNodeRange(node));
        }
      }

      expandedConfig[group] = {
        nodes: expandedNodes,
        description: data.description,
      };
    }

    return expandedConfig;
  } catch (error) {
    console.error("Error loading node configuration:", error);
    return {};
  }
};
