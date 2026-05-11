"use client";

import { memo, type ComponentProps, type ReactNode } from "react";
import { BotCard, BotMessage } from "@/components/llm/message";
import { SlurmJobDetails } from "@/components/llm/llm-slurm-job-details";
import { SlurmNodeDetails } from "@/components/llm/llm-slurm-node-details";
import { SlurmPartitionDetails } from "@/components/llm/llm-slurm-partition-details";
import { SlurmReservationDetails } from "@/components/llm/llm-slurm-reservation-details";
import { SlurmReservationList } from "@/components/llm/llm-slurm-reservation-list";
import { SlurmQosDetails } from "@/components/llm/llm-slurm-qos-details";
import { Loader2 } from "lucide-react";

type ToolResult = Record<string, unknown>;
type ToolResultRenderer = (result: ToolResult) => ReactNode;

interface ToolInvocationLike {
  toolName?: string;
  type?: string;
  state: string;
  output?: unknown;
  errorText?: string;
}

interface ToolInvocationRendererProps {
  toolInvocation: ToolInvocationLike;
}

const TOOL_RESULT_RENDERERS: Record<string, ToolResultRenderer> = {
  get_job_details: (result) => (
    <SlurmJobDetails job={result as ComponentProps<typeof SlurmJobDetails>["job"]} />
  ),
  get_node_details: (result) => (
    <SlurmNodeDetails node={result as ComponentProps<typeof SlurmNodeDetails>["node"]} />
  ),
  get_partition_details: (result) => (
    <SlurmPartitionDetails
      partition={result as ComponentProps<typeof SlurmPartitionDetails>["partition"]}
    />
  ),
  get_reservation_details: (result) => (
    <SlurmReservationDetails
      reservation={result as ComponentProps<typeof SlurmReservationDetails>["reservation"]}
    />
  ),
  list_reservations: (result) => (
    <SlurmReservationList
      reservations={
        getRecordArray(result.reservations) as ComponentProps<
          typeof SlurmReservationList
        >["reservations"]
      }
    />
  ),
  get_qos_details: (result) => (
    <SlurmQosDetails qos={result as ComponentProps<typeof SlurmQosDetails>["qos"]} />
  ),
  get_cluster_info: (result) => (
    <GenericJsonResult title="Cluster Information" value={result} />
  ),
  list_qos: (result) => (
    <NameBadgeList title="Available QoS" records={getRecordArray(result.qos)} />
  ),
  list_partitions: (result) => (
    <NameBadgeList
      title="Available Partitions"
      records={getRecordArray(result.partitions)}
    />
  ),
  search_documentation: renderDocumentationSearch,
  troubleshoot_job: renderTroubleshootJob,
  sbatch_helper: renderSbatchHelper,
  node_health_check: renderNodeHealthCheck,
};

function getToolName(toolInvocation: ToolInvocationLike) {
  if (toolInvocation.toolName) return toolInvocation.toolName;
  if (toolInvocation.type?.startsWith("tool-")) {
    return toolInvocation.type.substring(5);
  }

  return undefined;
}

function isObjectRecord(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown) {
  return isObjectRecord(value) ? value : undefined;
}

function getRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isObjectRecord) : [];
}

function getDisplayName(toolName?: string, toolUiName?: string) {
  return toolUiName || toolName || "tool";
}

function sanitizeResultForDisplay(result: ToolResult) {
  const displayResult = { ...result };
  delete displayResult._toolUi;

  return displayResult;
}

function getSupplementalResult(result: ToolResult) {
  const supplemental = { ...result };
  delete supplemental.error;
  delete supplemental._toolUi;

  return Object.keys(supplemental).length > 0 ? supplemental : undefined;
}

function renderToolResult(toolName: string | undefined, result: ToolResult) {
  const renderer = toolName ? TOOL_RESULT_RENDERERS[toolName] : undefined;
  return renderer ? (
    renderer(result)
  ) : (
    <GenericJsonResult title="Result" value={result} />
  );
}

function renderTroubleshootJob(result: ToolResult) {
  const job = getRecord(result.job);
  const node = getRecord(result.node);

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Job Troubleshooting</h3>
      {getRecordArray(job?.jobs).length > 0 && (
        <SlurmJobDetails job={job as ComponentProps<typeof SlurmJobDetails>["job"]} />
      )}
      {getRecordArray(node?.nodes).length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <SlurmNodeDetails node={node as ComponentProps<typeof SlurmNodeDetails>["node"]} />
        </div>
      )}
      {!job && !node && (
        <GenericJsonResult title="Workflow Result" value={result} compact />
      )}
    </div>
  );
}

function renderSbatchHelper(result: ToolResult) {
  const partitions = getRecordArray(getRecord(result.partitions)?.partitions);
  const qos = getRecordArray(getRecord(result.qos)?.qos);

  return (
    <div className="p-4 space-y-2">
      <h3 className="font-semibold text-sm">Cluster Configuration</h3>
      <NameBadgeList records={partitions} compact />
      {qos.length > 0 && <NameBadgeList records={qos} compact />}
    </div>
  );
}

function renderNodeHealthCheck(result: ToolResult) {
  const node = getRecord(result.node);

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Node Health Check</h3>
      {getRecordArray(node?.nodes).length > 0 ? (
        <SlurmNodeDetails node={node as ComponentProps<typeof SlurmNodeDetails>["node"]} />
      ) : (
        <GenericJsonResult title="Workflow Result" value={result} compact />
      )}
    </div>
  );
}

function renderDocumentationSearch(result: ToolResult) {
  const results = getRecordArray(result.results);
  const source = getRecord(result.source);
  const documentationUrl = getString(source?.documentationUrl);
  const indexedPages = getString(source?.indexedPages);
  const discoveredPages = getString(source?.discoveredPages);
  const pageCount =
    discoveredPages && discoveredPages !== indexedPages
      ? `${indexedPages || "configured"} of ${discoveredPages}`
      : indexedPages || "configured";

  return (
    <div className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Documentation Search</h3>
        {documentationUrl && (
          <p className="text-xs text-muted-foreground mt-1">
            Indexed {pageCount} pages from{" "}
            <a
              href={documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {documentationUrl}
            </a>
          </p>
        )}
      </div>

      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((record, index) => {
            const title = getString(record.title, "Documentation result");
            const url = getString(record.url);
            const snippet = getString(record.snippet);

            return (
              <div key={`${url || title}-${index}`} className="rounded-md border bg-muted/20 p-3">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium underline underline-offset-2"
                  >
                    {title}
                  </a>
                ) : (
                  <div className="text-sm font-medium">{title}</div>
                )}
                {snippet && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {snippet}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No matching documentation pages were returned.
        </p>
      )}
    </div>
  );
}

function GenericErrorResult({ result }: { result: ToolResult }) {
  const supplemental = getSupplementalResult(result);

  return (
    <div className="p-4 space-y-3">
      <div className="text-destructive text-sm">
        {typeof result.error === "string" ? result.error : "Tool call failed."}
      </div>
      {supplemental && (
        <GenericJsonResult title="Additional Context" value={supplemental} />
      )}
    </div>
  );
}

function GenericJsonResult({
  title,
  value,
  compact = false,
}: {
  title: string;
  value: unknown;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "p-4"}>
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
        {JSON.stringify(sanitizeUnknownForDisplay(value), null, 2)}
      </pre>
    </div>
  );
}

function NameBadgeList({
  title,
  records,
  compact = false,
}: {
  title?: string;
  records: ToolResult[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "p-4"}>
      {title && <h3 className="font-semibold mb-2 text-sm">{title}</h3>}
      <div className="flex flex-wrap gap-2">
        {records.map((record, index) => {
          const name =
            typeof record.name === "string" && record.name.length > 0
              ? record.name
              : "Unknown";

          return (
            <span
              key={`${name}-${index}`}
              className="bg-muted px-2 py-1 rounded text-xs"
            >
              {name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function sanitizeUnknownForDisplay(value: unknown): unknown {
  return isObjectRecord(value) ? sanitizeResultForDisplay(value) : value;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" && value.length > 0
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}

export const ToolInvocationRenderer = memo(function ToolInvocationRenderer({
  toolInvocation,
}: ToolInvocationRendererProps) {
  const toolName = getToolName(toolInvocation);

  if (toolInvocation.state === "output-available") {
    const result = getRecord(toolInvocation.output) ?? {};
    const content =
      typeof result.error === "string" ? (
        <GenericErrorResult result={result} />
      ) : (
        renderToolResult(toolName, result)
      );

    return <BotCard>{content}</BotCard>;
  }

  if (toolInvocation.state === "output-error") {
    return (
      <BotCard>
        <div className="p-4 text-destructive">
          Error calling {getDisplayName(toolName)}: {toolInvocation.errorText}
        </div>
      </BotCard>
    );
  }

  return (
    <BotMessage>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Calling {getDisplayName(toolName)}...</span>
      </div>
    </BotMessage>
  );
});
