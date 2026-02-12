import fs from "fs/promises";
import path from "path";

export interface RackConfig {
    nodes: string[];
    description: string;
}

export interface DashboardConfig {
    excludedNodes: string[];
    rackLayout: { [key: string]: RackConfig };
}

// Cache the config to avoid reading file on every request
let configCache: { data: DashboardConfig; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute cache

// Allow the node configuration path to be overridden via environment variable.
// Defaults to "infra/node.cfg" relative to the app root.
const NODEVIEW_CONFIG_PATH = process.env.NODEVIEW_CONFIG_PATH || "infra/node.cfg";

/**
 * Expands a node range pattern like "sc001..056" into individual node names.
 * Returns single node as-is if no range pattern found.
 */
export function expandNodeRange(nodeRange: string): string[] {
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
}

/**
 * Expands an array of node patterns into a flat array of hostnames.
 */
export function expandNodePatterns(patterns: string[]): string[] {
    return patterns.flatMap(expandNodeRange);
}

/**
 * Creates a Set of excluded node hostnames for O(1) lookup.
 */
export function getExcludedNodeSet(config: DashboardConfig): Set<string> {
    return new Set(expandNodePatterns(config.excludedNodes || []));
}

/**
 * Reads and parses the dashboard config file.
 * Returns a default empty config if file is missing or malformed.
 */
export async function loadDashboardConfig(): Promise<DashboardConfig> {
    const now = Date.now();

    // Return cached config if still valid
    if (configCache && now - configCache.timestamp < CACHE_TTL) {
        return configCache.data;
    }

    const defaultConfig: DashboardConfig = {
        excludedNodes: [],
        rackLayout: {},
    };

    try {
        const configPath = path.isAbsolute(NODEVIEW_CONFIG_PATH)
            ? NODEVIEW_CONFIG_PATH
            : path.join(process.cwd(), NODEVIEW_CONFIG_PATH);

        const rawContent = await fs.readFile(configPath, "utf-8");

        // Strip // comments before parsing
        const configContent = rawContent
            .split("\n")
            .filter((line) => !line.trim().startsWith("//"))
            .join("\n");

        const parsed = JSON.parse(configContent);

        // Handle both old format (flat rack layout) and new format (with excludedNodes/rackLayout)
        let config: DashboardConfig;

        if (parsed.rackLayout) {
            // New format
            config = {
                excludedNodes: parsed.excludedNodes || [],
                rackLayout: parsed.rackLayout,
            };
        } else {
            // Old format - treat entire object as rackLayout
            config = {
                excludedNodes: [],
                rackLayout: parsed,
            };
        }

        // Update cache
        configCache = { data: config, timestamp: now };

        return config;
    } catch (error) {
        // Return default config on any error (missing file, parse error, etc.)
        return defaultConfig;
    }
}

/**
 * Clears the config cache. Useful for testing or forcing a reload.
 */
export function clearConfigCache(): void {
    configCache = null;
}
