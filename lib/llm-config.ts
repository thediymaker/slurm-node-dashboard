import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { fetchSlurmData } from "@/lib/slurm-api";
import { buildBuiltinToolTurnUI } from "@/lib/builtin-tool-turn-ui";
import { attachToolTurnUI, type ToolTurnUI } from "@/lib/tool-turn-ui";

// =============================================================================
// Types
// =============================================================================

export interface ToolParameter {
  name: string;
  type: "string" | "number";
  description: string;
  required: boolean;
}

export interface ToolExecution {
  type: "slurm" | "slurmdb" | "http";
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  error_message?: string;
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  builtin: boolean;
  category: string;
  parameters: ToolParameter[];
  prompt_guidance?: string;
  execution?: ToolExecution;
}

export interface ToolConfigInput extends Omit<Partial<ToolConfig>, "execution"> {
  execution?: Partial<ToolExecution>;
}

export interface ClusterInfo {
  name: string;
  description: string;
  organization: string;
  documentation_url: string;
  support_email: string;
  notes: string;
}

export interface Defaults {
  partition: string;
  qos: string;
  walltime: string;
  nodes: number;
  ntasks_per_node: number;
  mail_type: string;
  output_pattern: string;
  error_pattern: string;
}

export interface RestrictedTopic {
  topic: string;
  redirect: string;
}

export interface LLMAssistantConfig {
  cluster: ClusterInfo;
  system_prompt: string;
  defaults: Defaults;
  custom_instructions: string;
  restricted_topics: RestrictedTopic[];
  tools: ToolConfig[];
}

export interface LLMAssistantConfigInput
  extends Omit<Partial<LLMAssistantConfig>, "cluster" | "defaults" | "tools"> {
  cluster?: Partial<ClusterInfo>;
  defaults?: Partial<Defaults>;
  tools?: ToolConfigInput[];
}

// =============================================================================
// Cache
// =============================================================================

let configCache: { data: LLMAssistantConfig; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

export const LLM_CONFIG_PATH = path.join(
  process.cwd(),
  "infra",
  "llm-assistant.yaml"
);

export const LLM_LOCAL_CONFIG_PATH = path.join(
  process.cwd(),
  "infra",
  "llm-assistant.local.yaml"
);

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_CONFIG: LLMAssistantConfig = {
  cluster: {
    name: "HPC Cluster",
    description: "",
    organization: "",
    documentation_url: "",
    support_email: "",
    notes: "",
  },
  system_prompt: "You are a specialized Slurm HPC assistant.",
  defaults: {
    partition: "",
    qos: "",
    walltime: "01:00:00",
    nodes: 1,
    ntasks_per_node: 1,
    mail_type: "END,FAIL",
    output_pattern: "%x_%j.out",
    error_pattern: "%x_%j.err",
  },
  custom_instructions: "",
  restricted_topics: [],
  tools: [],
};

// =============================================================================
// Config Loader
// =============================================================================

export function invalidateCache() {
  configCache = null;
}

interface LLMConfigSource {
  exists: boolean;
  raw: string;
  parsed: LLMAssistantConfigInput;
}

const EMPTY_CONFIG_SOURCE: LLMConfigSource = {
  exists: false,
  raw: "",
  parsed: {},
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToolConfig(tool: ToolConfigInput): ToolConfig {
  const execution: ToolExecution | undefined =
    tool.execution?.type && tool.execution.endpoint
      ? {
          type: tool.execution.type,
          endpoint: tool.execution.endpoint,
          method: tool.execution.method,
          headers: tool.execution.headers,
          error_message: tool.execution.error_message,
        }
      : undefined;

  return {
    id: tool.id || "",
    name: tool.name || "",
    description: tool.description || "",
    enabled: tool.enabled !== false,
    builtin: tool.builtin !== false,
    category: tool.category || "custom",
    parameters: tool.parameters || [],
    prompt_guidance: tool.prompt_guidance,
    execution,
  };
}

function mergeToolConfigs(
  baseTools: ToolConfigInput[] = [],
  overrideTools: ToolConfigInput[] = []
): ToolConfig[] {
  const mergedTools = new Map<string, ToolConfig>();

  for (const tool of baseTools) {
    const normalizedTool = normalizeToolConfig(tool);
    mergedTools.set(normalizedTool.id, normalizedTool);
  }

  for (const tool of overrideTools) {
    const existingTool = tool.id ? mergedTools.get(tool.id) : undefined;
    const mergedTool = normalizeToolConfig({
      ...existingTool,
      ...tool,
      parameters: tool.parameters ?? existingTool?.parameters ?? [],
      execution:
        isPlainObject(existingTool?.execution) || isPlainObject(tool.execution)
          ? {
              ...(existingTool?.execution || {}),
              ...(tool.execution || {}),
            }
          : existingTool?.execution ?? tool.execution,
    });

    mergedTools.set(mergedTool.id, mergedTool);
  }

  return Array.from(mergedTools.values());
}

export function mergeLLMConfigPartials(
  baseConfig: LLMAssistantConfigInput,
  overrideConfig: LLMAssistantConfigInput
): LLMAssistantConfigInput {
  return {
    ...baseConfig,
    ...overrideConfig,
    cluster: {
      ...(baseConfig.cluster || {}),
      ...(overrideConfig.cluster || {}),
    },
    defaults: {
      ...(baseConfig.defaults || {}),
      ...(overrideConfig.defaults || {}),
    },
    restricted_topics:
      overrideConfig.restricted_topics ?? baseConfig.restricted_topics,
    tools: overrideConfig.tools
      ? mergeToolConfigs(baseConfig.tools || [], overrideConfig.tools)
      : mergeToolConfigs(baseConfig.tools || []),
  };
}

export function buildLLMConfig(
  parsed: LLMAssistantConfigInput
): LLMAssistantConfig {
  const cluster: ClusterInfo = {
    ...DEFAULT_CONFIG.cluster,
    ...(parsed.cluster || {}),
  };
  const defaults: Defaults = {
    ...DEFAULT_CONFIG.defaults,
    ...(parsed.defaults || {}),
  };

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    cluster,
    defaults,
    tools: mergeToolConfigs(parsed.tools || []),
    restricted_topics: parsed.restricted_topics || [],
    system_prompt: parsed.system_prompt || DEFAULT_CONFIG.system_prompt,
    custom_instructions: parsed.custom_instructions || "",
  };
}

function isEqualValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => isEqualValue(item, right[index]))
    );
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of keys) {
      if (!isEqualValue(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function diffObject<T extends object>(
  baseObject: T,
  nextObject: T
): Partial<T> | undefined {
  const diff: Partial<T> = {};
  const keys = new Set([...Object.keys(baseObject), ...Object.keys(nextObject)]);

  for (const key of keys) {
    const typedKey = key as keyof T;

    if (isEqualValue(baseObject[typedKey], nextObject[typedKey])) continue;
    diff[typedKey] = nextObject[typedKey];
  }

  return Object.keys(diff).length > 0 ? diff : undefined;
}

function diffToolConfigs(
  baseTools: ToolConfig[],
  nextTools: ToolConfig[]
): ToolConfigInput[] | undefined {
  const overrides: ToolConfigInput[] = [];
  const baseToolsById = new Map(baseTools.map((tool) => [tool.id, tool]));
  const nextToolIds = new Set(nextTools.map((tool) => tool.id));

  for (const tool of nextTools) {
    const baseTool = baseToolsById.get(tool.id);

    if (!baseTool) {
      overrides.push({
        ...tool,
        execution: tool.execution ? { ...tool.execution } : undefined,
      });
      continue;
    }

    const toolDiff = diffObject(baseTool, tool);
    if (!toolDiff) continue;

    overrides.push({
      id: tool.id,
      ...(toolDiff as ToolConfigInput),
    });
  }

  for (const tool of baseTools) {
    if (nextToolIds.has(tool.id) || tool.enabled === false) continue;
    overrides.push({ id: tool.id, enabled: false });
  }

  return overrides.length > 0 ? overrides : undefined;
}

export function buildLLMConfigOverride(
  baseConfig: LLMAssistantConfig,
  nextConfig: LLMAssistantConfig
): LLMAssistantConfigInput {
  const override: LLMAssistantConfigInput = {};
  const clusterOverride = diffObject(baseConfig.cluster, nextConfig.cluster);
  const defaultsOverride = diffObject(baseConfig.defaults, nextConfig.defaults);
  const toolOverrides = diffToolConfigs(baseConfig.tools, nextConfig.tools);

  if (clusterOverride) {
    override.cluster = clusterOverride as Partial<ClusterInfo>;
  }

  if (defaultsOverride) {
    override.defaults = defaultsOverride as Partial<Defaults>;
  }

  if (!isEqualValue(baseConfig.system_prompt, nextConfig.system_prompt)) {
    override.system_prompt = nextConfig.system_prompt;
  }

  if (
    !isEqualValue(
      baseConfig.custom_instructions,
      nextConfig.custom_instructions
    )
  ) {
    override.custom_instructions = nextConfig.custom_instructions;
  }

  if (
    !isEqualValue(
      baseConfig.restricted_topics,
      nextConfig.restricted_topics
    )
  ) {
    override.restricted_topics = nextConfig.restricted_topics;
  }

  if (toolOverrides) {
    override.tools = toolOverrides;
  }

  return override;
}

async function readLLMConfigSource(
  filePath: string,
  optional = false
): Promise<LLMConfigSource> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = (yaml.load(raw) as LLMAssistantConfigInput | undefined) || {};
    return {
      exists: true,
      raw,
      parsed,
    };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;

    if (optional && error.code === "ENOENT") {
      return EMPTY_CONFIG_SOURCE;
    }

    throw err;
  }
}

export async function loadLLMConfigSources() {
  const base = await readLLMConfigSource(LLM_CONFIG_PATH);

  let local = EMPTY_CONFIG_SOURCE;
  try {
    local = await readLLMConfigSource(LLM_LOCAL_CONFIG_PATH, true);
  } catch (err) {
    console.warn(
      `[llm-config] Could not load ${LLM_LOCAL_CONFIG_PATH}, ignoring local overrides:`,
      (err as Error).message
    );
  }

  return { base, local };
}

export async function loadBaseLLMConfig(): Promise<LLMAssistantConfig> {
  const baseSource = await readLLMConfigSource(LLM_CONFIG_PATH);
  return buildLLMConfig(baseSource.parsed);
}

export async function loadLLMConfig(): Promise<LLMAssistantConfig> {
  const now = Date.now();
  if (configCache && now - configCache.timestamp < CACHE_TTL) {
    return configCache.data;
  }

  try {
    const { base, local } = await loadLLMConfigSources();
    const mergedConfig = mergeLLMConfigPartials(base.parsed, local.parsed);
    const config = buildLLMConfig(mergedConfig);
    configCache = { data: config, timestamp: now };
    return config;
  } catch (err) {
    console.warn(
      `[llm-config] Could not load ${LLM_CONFIG_PATH}, using defaults:`,
      (err as Error).message
    );
    configCache = { data: DEFAULT_CONFIG, timestamp: now };
    return DEFAULT_CONFIG;
  }
}

// =============================================================================
// Built-in Tool Executors
// =============================================================================
// These contain the nuanced multi-step logic that can't easily be expressed
// in config. Custom tools use the generic executor below instead.
// =============================================================================

type ToolParams = Record<string, unknown>;
type ToolExecutor = (params: ToolParams) => Promise<unknown>;

function getParamString(params: ToolParams, name: string) {
  const value = params[name];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getFirstValue(values: unknown[]) {
  return values.length > 0 ? values[0] : undefined;
}

function getFirstRecord(value: unknown) {
  return asRecord(getFirstValue(asArray(value)));
}

function getString(value: unknown) {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";
}

function getNameList(values: unknown[]) {
  return values
    .map((value) => getString(asRecord(value)?.name))
    .filter(Boolean)
    .join(", ");
}

const BUILTIN_EXECUTORS: Record<string, ToolExecutor> = {
  get_job_details: async (params) => {
    const job = getParamString(params, "job");
    const { data: activeData, error: activeError } = await fetchSlurmData(
      `/job/${job}`
    );
    if (
      !activeError &&
      activeData?.jobs?.length &&
      !activeData?.errors?.length
    ) {
      return { ...activeData, jobStatus: "active" };
    }
    const { data: histData, error: histError } = await fetchSlurmData(
      `/job/${job}`,
      { type: "slurmdb" }
    );
    if (
      !histError &&
      histData?.jobs?.length &&
      !histData?.errors?.length
    ) {
      return { ...histData, jobStatus: "completed" };
    }
    return {
      error: `Job '${job}' not found in active or historical job records. The job ID may be invalid, or the job data may have been purged from the accounting database.`,
    };
  },

  get_node_details: async (params) => {
    const node = getParamString(params, "node");
    const { data, error } = await fetchSlurmData(`/node/${node}`);
    if (error || !data?.nodes?.length || data?.errors?.length) {
      const { data: listData, error: listError } = await fetchSlurmData(
        `/nodes`
      );
      if (!listError && listData?.nodes) {
        const nodeRecords = asArray(listData.nodes);
        const nodes = getNameList(nodeRecords.slice(0, 10));
        return {
          error: `Node '${node}' not found.`,
          availableNodes: `${nodes}${nodeRecords.length > 10 ? "..." : ""}`,
        };
      }
      return {
        error: `Error fetching node details: ${error || "Node not found"}`,
      };
    }
    return data;
  },

  get_partition_details: async (params) => {
    const partition = getParamString(params, "partition");
    const { data, error } = await fetchSlurmData(`/partition/${partition}`);
    if (error || !data?.partitions?.length || data?.errors?.length) {
      const { data: listData, error: listError } = await fetchSlurmData(
        `/partitions`
      );
      if (!listError && listData?.partitions) {
        const partitions = getNameList(asArray(listData.partitions));
        return {
          error: `Partition '${partition}' not found.`,
          availablePartitions: partitions,
        };
      }
      return {
        error: `Error fetching partition details: ${error || "Partition not found"}`,
      };
    }
    return data;
  },

  get_reservation_details: async (params) => {
    const reservation = getParamString(params, "reservation");
    const { data: resDetails, error } = await fetchSlurmData(
      `/reservation/${reservation}`
    );
    if (error || !resDetails?.reservations?.length) {
      const { data: listData, error: listError } = await fetchSlurmData(
        `/reservations`
      );
      if (!listError && listData) {
        return {
          error: `Reservation '${reservation}' not found.`,
          availableReservations: listData.reservations,
        };
      }
      return {
        error: `Error fetching reservation details: ${error}`,
      };
    }
    return resDetails;
  },

  list_reservations: async () => {
    const { data, error } = await fetchSlurmData(`/reservations`);
    if (error) return { error: `Error fetching reservations: ${error}` };
    return data;
  },

  get_qos_details: async (params) => {
    const qos = getParamString(params, "qos");
    const { data, error } = await fetchSlurmData(`/qos/${qos}`, {
      type: "slurmdb",
    });
    if (
      error ||
      (data?.qos && Array.isArray(data.qos) && data.qos.length === 0)
    ) {
      const { data: listData, error: listError } = await fetchSlurmData(
        `/qos`,
        { type: "slurmdb" }
      );
      if (!listError && listData?.qos) {
        const qosList = getNameList(asArray(listData.qos));
        return {
          error: `QoS '${qos}' not found.`,
          availableQoS: qosList,
        };
      }
      return {
        error: `Error fetching QoS details: ${error || "Not found"}`,
      };
    }
    return data;
  },

  get_cluster_info: async () => {
    const { data, error } = await fetchSlurmData("/clusters", {
      type: "slurmdb",
    });
    if (error) return { error: `Error fetching cluster info: ${error}` };
    return data;
  },

  list_qos: async () => {
    const { data, error } = await fetchSlurmData(`/qos`, {
      type: "slurmdb",
    });
    if (error) return { error: `Error fetching QoS list: ${error}` };
    return data;
  },

  list_partitions: async () => {
    const { data, error } = await fetchSlurmData(`/partitions`);
    if (error) return { error: `Error fetching partitions: ${error}` };
    return data;
  },

  // Workflow tools orchestrate multiple API calls and return combined context.

  troubleshoot_job: async (params) => {
    const job = getParamString(params, "job");
    const results: Record<string, unknown> = {};

    // Step 1: Get job details, falling back from active to historical records.
    const { data: activeData, error: activeError } = await fetchSlurmData(
      `/job/${job}`
    );
    if (
      !activeError &&
      activeData?.jobs?.length &&
      !activeData?.errors?.length
    ) {
      results.job = { ...activeData, jobStatus: "active" };
    } else {
      const { data: histData, error: histError } = await fetchSlurmData(
        `/job/${job}`,
        { type: "slurmdb" }
      );
      if (
        !histError &&
        histData?.jobs?.length &&
        !histData?.errors?.length
      ) {
        results.job = { ...histData, jobStatus: "completed" };
      } else {
        return {
          error: `Job '${job}' not found in active or historical records.`,
        };
      }
    }

    // Step 2: Extract partition and node from job data, fetch their details
    const jobInfo = getFirstRecord(asRecord(results.job)?.jobs);
    if (jobInfo) {
      const partition = getString(jobInfo.partition);
      const jobResources = asRecord(jobInfo.job_resources);
      const jobResourceNodes = asRecord(jobResources?.nodes);
      const allocationNode = getFirstRecord(jobResourceNodes?.allocation);
      const nodeList =
        getString(jobInfo.nodes) || getString(allocationNode?.nodename);

      if (partition) {
        const { data: partData } = await fetchSlurmData(
          `/partition/${partition}`
        );
        if (partData?.partitions?.length) {
          results.partition = partData;
        }
      }

      if (nodeList) {
        // Take the first node from a potential range like "node[01-04]"
        const firstNode = nodeList.replace(/\[.*/, "").replace(/,.*/, "");
        if (firstNode && firstNode !== "(null)") {
          const { data: nodeData } = await fetchSlurmData(
            `/node/${firstNode}`
          );
          if (nodeData?.nodes?.length) {
            results.node = nodeData;
          }
        }
      }
    }

    return { _workflow: "troubleshoot_job", ...results };
  },

  sbatch_helper: async (params) => {
    const request = getParamString(params, "request");
    const results: Record<string, unknown> = { request };

    // Fetch partitions and QoS in parallel
    const [partRes, qosRes, clusterRes] = await Promise.all([
      fetchSlurmData(`/partitions`),
      fetchSlurmData(`/qos`, { type: "slurmdb" }),
      fetchSlurmData(`/clusters`, { type: "slurmdb" }),
    ]);

    if (!partRes.error && partRes.data) {
      results.partitions = partRes.data;
    }
    if (!qosRes.error && qosRes.data) {
      results.qos = qosRes.data;
    }
    if (!clusterRes.error && clusterRes.data) {
      results.cluster = clusterRes.data;
    }

    return { _workflow: "sbatch_helper", ...results };
  },

  node_health_check: async (params) => {
    const node = getParamString(params, "node");
    const results: Record<string, unknown> = {};

    // Fetch node details and cluster info in parallel
    const [nodeRes, clusterRes] = await Promise.all([
      fetchSlurmData(`/node/${node}`),
      fetchSlurmData(`/clusters`, { type: "slurmdb" }),
    ]);

    if (nodeRes.error || !nodeRes.data?.nodes?.length) {
      const { data: listData } = await fetchSlurmData(`/nodes`);
      if (listData?.nodes) {
        const nodeRecords = asArray(listData.nodes);
        const names = getNameList(nodeRecords.slice(0, 10));
        return {
          error: `Node '${node}' not found.`,
          availableNodes: `${names}${nodeRecords.length > 10 ? "..." : ""}`,
        };
      }
      return { error: `Node '${node}' not found.` };
    }

    results.node = nodeRes.data;
    if (!clusterRes.error && clusterRes.data) {
      results.cluster = clusterRes.data;
    }

    // Also get the partition this node belongs to
    const nodeInfo = getFirstRecord(asRecord(nodeRes.data)?.nodes);
    const partitions = asArray(nodeInfo?.partitions);
    if (partitions.length > 0) {
      const firstPartition = getFirstValue(partitions);
      const partName =
        typeof firstPartition === "string"
          ? firstPartition
          : getString(asRecord(firstPartition)?.name);
      if (partName) {
        const { data: partData } = await fetchSlurmData(
          `/partition/${partName}`
        );
        if (partData?.partitions?.length) {
          results.partition = partData;
        }
      }
    }

    return { _workflow: "node_health_check", ...results };
  },
};

// =============================================================================
// Custom Tool Executor Factory
// =============================================================================

function createCustomExecutor(execution: ToolExecution) {
  return async (params: ToolParams) => {
    // Interpolate {param} placeholders in the endpoint
    let endpoint = execution.endpoint;
    for (const [key, value] of Object.entries(params)) {
      endpoint = endpoint.replace(`{${key}}`, String(value));
    }

    if (execution.type === "http") {
      try {
        const res = await fetch(endpoint, {
          method: execution.method || "GET",
          headers: execution.headers || {},
        });
        if (!res.ok)
          return {
            error:
              execution.error_message ||
              `HTTP ${res.status}: ${res.statusText}`,
          };
        return await res.json();
      } catch (err) {
        return {
          error:
            execution.error_message ||
            `Request failed: ${(err as Error).message}`,
        };
      }
    }

    // Slurm / SlurmDB
    const apiType = execution.type === "slurmdb" ? "slurmdb" : "slurm";
    const { data, error } = await fetchSlurmData(endpoint, { type: apiType });
    if (error) return { error: execution.error_message || `Error: ${error}` };
    return data;
  };
}

// =============================================================================
// Dynamic Zod Schema Builder
// =============================================================================

function buildZodSchema(parameters: ToolParameter[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of parameters) {
    let field: z.ZodTypeAny;
    switch (param.type) {
      case "number":
        field = z.number().describe(param.description);
        break;
      default:
        field = z.string().describe(param.description);
        break;
    }
    if (!param.required) {
      field = field.optional() as z.ZodTypeAny;
    }
    shape[param.name] = field;
  }
  return z.object(shape);
}

function buildGenericFollowUpContext(toolConfig: ToolConfig) {
  const displayName = toolConfig.name || toolConfig.id;
  const category = toolConfig.category || "custom";

  return `A ${displayName} tool card was shown for the ${category} area. Generate short follow-up questions about the user's next useful Slurm action using the tool card and any configured tool guidance.`;
}

function buildConfiguredToolTurnUI(
  toolConfig: ToolConfig,
  result: unknown,
  params: Record<string, unknown>
): ToolTurnUI {
  const builtinToolUi =
    toolConfig.builtin && BUILTIN_EXECUTORS[toolConfig.id]
      ? buildBuiltinToolTurnUI(toolConfig.id, result, params)
      : undefined;
  const promptGuidance = toolConfig.prompt_guidance?.trim() || undefined;

  return {
    toolId: toolConfig.id,
    toolName: toolConfig.name,
    category: toolConfig.category,
    followUpContext:
      builtinToolUi?.followUpContext || buildGenericFollowUpContext(toolConfig),
    promptGuidance,
  };
}

// =============================================================================
// Dynamic Tool & Prompt Builder  (called from the chat route)
// =============================================================================

export function buildToolsAndPrompt(config: LLMAssistantConfig) {
  const tools: ToolSet = {};
  const guidanceSections: string[] = [];

  for (const tc of config.tools) {
    if (!tc.enabled) continue;

    // Build the Zod input schema
    const inputSchema = buildZodSchema(tc.parameters);

    // Resolve the execute function
    let execute: ToolExecutor | undefined;
    if (tc.builtin && BUILTIN_EXECUTORS[tc.id]) {
      const builtinExecute = BUILTIN_EXECUTORS[tc.id];
      execute = async (params: Record<string, unknown>) => {
        const result = await builtinExecute(params);
        return attachToolTurnUI(
          result,
          buildConfiguredToolTurnUI(tc, result, params)
        );
      };
    } else if (!tc.builtin && tc.execution) {
      const customExecute = createCustomExecutor(tc.execution);
      execute = async (params: Record<string, unknown>) => {
        const result = await customExecute(params);
        return attachToolTurnUI(
          result,
          buildConfiguredToolTurnUI(tc, result, params)
        );
      };
    }

    if (!execute) continue; // skip tools with no executor

    tools[tc.id] = tool({
      description: tc.description,
      inputSchema,
      execute,
    });

    // Collect per-tool prompt guidance
    if (tc.prompt_guidance?.trim()) {
      guidanceSections.push(
        `When using "${tc.id}" (${tc.name}):\n${tc.prompt_guidance.trim()}`
      );
    }
  }

  // Assemble the full system prompt.
  const promptParts: string[] = [];

  // Base system prompt
  promptParts.push(config.system_prompt.trim());

  // Cluster identity
  const c = config.cluster;
  if (c.name) {
    promptParts.push(
      `CLUSTER: ${c.name}` +
        (c.organization ? ` (${c.organization})` : "") +
        (c.description ? `\n${c.description}` : "") +
        (c.documentation_url ? `\nDocs: ${c.documentation_url}` : "") +
        (c.support_email ? `\nSupport: ${c.support_email}` : "") +
        (c.notes?.trim() ? `\n\n${c.notes.trim()}` : "")
    );
  }

  // Per-tool guidance
  if (guidanceSections.length > 0) {
    promptParts.push(
      `TOOL-SPECIFIC GUIDANCE:\n\n${guidanceSections.join("\n\n")}`
    );
  }

  // Default directives
  const d = config.defaults;
  if (d.partition || d.qos || d.walltime) {
    promptParts.push(
      `DEFAULT JOB DIRECTIVES (suggest when user doesn't specify):\n` +
        (d.partition ? `- Partition: ${d.partition}\n` : "") +
        (d.qos ? `- QoS: ${d.qos}\n` : "") +
        `- Walltime: ${d.walltime}\n` +
        `- Nodes: ${d.nodes}, Tasks/node: ${d.ntasks_per_node}\n` +
        `- Mail: ${d.mail_type}\n` +
        `- Output: ${d.output_pattern}, Error: ${d.error_pattern}`
    );
  }

  // Custom instructions
  if (config.custom_instructions?.trim()) {
    promptParts.push(config.custom_instructions.trim());
  }

  // Restricted topics
  if (config.restricted_topics?.length > 0) {
    const rt = config.restricted_topics
      .map((r) => `- "${r.topic}": respond "${r.redirect}"`)
      .join("\n");
    promptParts.push(`RESTRICTED TOPICS (refuse / redirect):\n${rt}`);
  }

  return {
    tools,
    systemPrompt: promptParts.join("\n\n---\n\n"),
  };
}
