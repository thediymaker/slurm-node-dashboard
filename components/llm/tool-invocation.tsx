"use client";

import { memo } from "react";
import { UIToolInvocation } from "ai";
import { BotCard, BotMessage } from "@/components/llm/message";
import { SlurmJobDetails } from "@/components/llm/llm-slurm-job-details";
import { SlurmNodeDetails } from "@/components/llm/llm-slurm-node-details";
import { SlurmPartitionDetails } from "@/components/llm/llm-slurm-partition-details";
import { SlurmReservationDetails } from "@/components/llm/llm-slurm-reservation-details";
import { SlurmReservationList } from "@/components/llm/llm-slurm-reservation-list";
import { SlurmQosDetails } from "@/components/llm/llm-slurm-qos-details";
import { Loader2 } from "lucide-react";

interface ToolInvocationRendererProps {
  toolInvocation: any;
}

export const ToolInvocationRenderer = memo(function ToolInvocationRenderer({ toolInvocation }: ToolInvocationRendererProps) {
  const toolCallId = toolInvocation.toolCallId;
  const toolName = toolInvocation.toolName || (toolInvocation.type?.startsWith("tool-") ? toolInvocation.type.substring(5) : undefined);

  if (toolInvocation.state === "output-available") {
    const result = toolInvocation.output;

    switch (toolName) {
      case "get_job_details":
        if (result.error) {
          return (
            <BotCard>
              <div className="text-center p-4 text-red-400">
                {result.error}
              </div>
            </BotCard>
          );
        }
        return (
          <BotCard>
            <SlurmJobDetails job={result} />
          </BotCard>
        );
      case "get_node_details":
        if (result.error)
          return (
            <BotCard>
              {result.error}{" "}
              {result.availableNodes &&
                `Available nodes: ${result.availableNodes}`}
            </BotCard>
          );
        return (
          <BotCard>
            <SlurmNodeDetails node={result} />
          </BotCard>
        );
      case "get_partition_details":
        if (result.error)
          return (
            <BotCard>
              {result.error}{" "}
              {result.availablePartitions &&
                `Available partitions: ${result.availablePartitions}`}
            </BotCard>
          );
        return (
          <BotCard>
            <SlurmPartitionDetails partition={result} />
          </BotCard>
        );
      case "get_reservation_details":
        if (result.error)
          return (
            <BotCard>
              {result.error}{" "}
              {result.availableReservations && (
                <SlurmReservationList
                  reservations={result.availableReservations}
                />
              )}
            </BotCard>
          );
        return (
          <BotCard>
            <SlurmReservationDetails reservation={result} />
          </BotCard>
        );
      case "list_reservations":
        return (
          <BotCard>
            <SlurmReservationList reservations={result.reservations} />
          </BotCard>
        );
      case "get_qos_details":
        if (result.error)
          return (
            <BotCard>
              {result.error}{" "}
              {result.availableQoS && `Available QoS: ${result.availableQoS}`}
            </BotCard>
          );
        return (
          <BotCard>
            <SlurmQosDetails qos={result} />
          </BotCard>
        );
      case "get_cluster_info":
        return (
          <BotCard>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Cluster Information</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </BotCard>
        );
      case "list_qos":
        return (
          <BotCard>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Available QoS</h3>
              <div className="flex flex-wrap gap-2">
                {result.qos?.map((q: any) => (
                  <span
                    key={q.name}
                    className="bg-muted px-2 py-1 rounded text-sm"
                  >
                    {q.name}
                  </span>
                ))}
              </div>
            </div>
          </BotCard>
        );
      case "list_partitions":
        return (
          <BotCard>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Available Partitions</h3>
              <div className="flex flex-wrap gap-2">
                {result.partitions?.map((p: any) => (
                  <span
                    key={p.name}
                    className="bg-muted px-2 py-1 rounded text-sm"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </BotCard>
        );
      default:
        return (
          <BotCard>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Result</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </BotCard>
        );
    }
  } else if (toolInvocation.state === "output-error") {
      return (
        <BotCard>
          <div className="p-4 text-destructive">
            Error calling {toolName}: {toolInvocation.errorText}
          </div>
        </BotCard>
      );
  } else {
    return (
      <BotMessage>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Calling {toolName}...</span>
        </div>
      </BotMessage>
    );
  }
  return null;
});

