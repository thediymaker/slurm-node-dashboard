import fs from "fs/promises";
import yaml from "js-yaml";
import { z } from "zod";
import { tool } from "ai";
import { fetchSlurmData } from "@/lib/slurm-api";

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

// =============================================================================
// Cache
// =============================================================================

let configCache: { data: LLMAssistantConfig; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

const LLM_CONFIG_PATH =
  process.env.LLM_CONFIG_PATH || "infra/llm-assistant.yaml";

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

export async function loadLLMConfig(): Promise<LLMAssistantConfig> {
  const now = Date.now();
  if (configCache && now - configCache.timestamp < CACHE_TTL) {
    return configCache.data;
  }

  try {
    const raw = await fs.readFile(LLM_CONFIG_PATH, "utf-8");
    const parsed = yaml.load(raw) as Partial<LLMAssistantConfig>;
    const config: LLMAssistantConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      cluster: { ...DEFAULT_CONFIG.cluster, ...(parsed.cluster || {}) },
      defaults: { ...DEFAULT_CONFIG.defaults, ...(parsed.defaults || {}) },
      tools: (parsed.tools || []).map((t) => ({
        ...t,
        parameters: t.parameters || [],
        enabled: t.enabled !== false,
        builtin: t.builtin !== false,
      })),
      restricted_topics: parsed.restricted_topics || [],
      system_prompt: parsed.system_prompt || DEFAULT_CONFIG.system_prompt,
      custom_instructions: parsed.custom_instructions || "",
    };
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

const BUILTIN_EXECUTORS: Record<string, (params: any) => Promise<any>> = {
  get_job_details: async ({ job }: { job: string }) => {
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

  get_node_details: async ({ node }: { node: string }) => {
    const { data, error } = await fetchSlurmData(`/node/${node}`);
    if (error || !data?.nodes?.length || data?.errors?.length) {
      const { data: listData, error: listError } = await fetchSlurmData(
        `/nodes`
      );
      if (!listError && listData?.nodes) {
        const nodes = listData.nodes
          .slice(0, 10)
          .map((n: any) => n.name)
          .join(", ");
        return {
          error: `Node '${node}' not found.`,
          availableNodes: `${nodes}${listData.nodes.length > 10 ? "..." : ""}`,
        };
      }
      return {
        error: `Error fetching node details: ${error || "Node not found"}`,
      };
    }
    return data;
  },

  get_partition_details: async ({ partition }: { partition: string }) => {
    const { data, error } = await fetchSlurmData(`/partition/${partition}`);
    if (error || !data?.partitions?.length || data?.errors?.length) {
      const { data: listData, error: listError } = await fetchSlurmData(
        `/partitions`
      );
      if (!listError && listData?.partitions) {
        const partitions = listData.partitions
          .map((p: any) => p.name)
          .join(", ");
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

  get_reservation_details: async ({
    reservation,
  }: {
    reservation: string;
  }) => {
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

  get_qos_details: async ({ qos }: { qos: string }) => {
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
        const qosList = listData.qos.map((q: any) => q.name).join(", ");
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

  // ─── Workflow Tools ────────────────────────────────────────────────
  // These orchestrate multiple API calls and return combined context.
  // ───────────────────────────────────────────────────────────────────

  troubleshoot_job: async ({ job }: { job: string }) => {
    const results: Record<string, any> = {};

    // Step 1: Get job details (active → historical fallback)
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
    const jobInfo = results.job?.jobs?.[0];
    if (jobInfo) {
      const partition = jobInfo.partition;
      const nodeList =
        jobInfo.nodes || jobInfo.job_resources?.nodes?.allocation?.[0]?.nodename;

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

  sbatch_helper: async ({ request }: { request: string }) => {
    const results: Record<string, any> = { request };

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

  node_health_check: async ({ node }: { node: string }) => {
    const results: Record<string, any> = {};

    // Fetch node details and cluster info in parallel
    const [nodeRes, clusterRes] = await Promise.all([
      fetchSlurmData(`/node/${node}`),
      fetchSlurmData(`/clusters`, { type: "slurmdb" }),
    ]);

    if (nodeRes.error || !nodeRes.data?.nodes?.length) {
      const { data: listData } = await fetchSlurmData(`/nodes`);
      if (listData?.nodes) {
        const names = listData.nodes
          .slice(0, 10)
          .map((n: any) => n.name)
          .join(", ");
        return {
          error: `Node '${node}' not found.`,
          availableNodes: `${names}${listData.nodes.length > 10 ? "..." : ""}`,
        };
      }
      return { error: `Node '${node}' not found.` };
    }

    results.node = nodeRes.data;
    if (!clusterRes.error && clusterRes.data) {
      results.cluster = clusterRes.data;
    }

    // Also get the partition this node belongs to
    const nodeInfo = nodeRes.data?.nodes?.[0];
    if (nodeInfo?.partitions?.length) {
      const partName =
        typeof nodeInfo.partitions[0] === "string"
          ? nodeInfo.partitions[0]
          : nodeInfo.partitions[0]?.name;
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
  return async (params: Record<string, any>) => {
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

// =============================================================================
// Dynamic Tool & Prompt Builder  (called from the chat route)
// =============================================================================

export function buildToolsAndPrompt(config: LLMAssistantConfig) {
  const tools: Record<string, any> = {};
  const guidanceSections: string[] = [];

  for (const tc of config.tools) {
    if (!tc.enabled) continue;

    // Build the Zod input schema
    const inputSchema = buildZodSchema(tc.parameters);

    // Resolve the execute function
    let execute: ((params: any) => Promise<any>) | undefined;
    if (tc.builtin && BUILTIN_EXECUTORS[tc.id]) {
      execute = BUILTIN_EXECUTORS[tc.id];
    } else if (!tc.builtin && tc.execution) {
      execute = createCustomExecutor(tc.execution);
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

  // ── Assemble the full system prompt ──
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
