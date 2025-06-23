"use server";

import { createAI, getMutableAIState, streamUI } from "ai/rsc";
import type { CoreMessage, ToolInvocation } from "ai";
import type { ReactNode } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { BotCard, BotMessage } from "@/components/llm/message";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { sleep } from "@/utils/nodes";
import { SlurmJobDetails } from "@/components/llm/llm-slurm-job-details";
import { SlurmNodeDetails } from "@/components/llm/llm-slurm-node-details";
import ReactMarkdown from "react-markdown";

const content = `
  You are a Slurm job scheduling bot that helps users get job, node, queue, reservation, accounting, and QoS details. 
  Messages inside [] indicate a UI element of a user event. For example: - "[Details for Job = 1234567]" means that 
  the interface of the job details for the job 1234567 is shown to the user. - "[Details for node = node_name]" means 
  that the interface of the node details for the node_name is shown to the user.

  If the user wants the job details, call \`get_job_details\` with the job ID. If the user wants the node details, call
  \`get_node_details\` with the node name, and so on.
  
  If a user asks anything else, give them generic Slurm user support, like how to create an sbatch, how to request GPU, how to see what partitions are available etc.
  If the user wants anything not related to slurm, it's an impossible task, and you should 
  respond that you are only able to provide slurm support, and basic job and node details.`;

export const sendMessage = async (
  message: string
): Promise<{
  id: number;
  role: "user" | "assistant";
  display: ReactNode;
}> => {
  const history = getMutableAIState<typeof AI>();

  history.update([
    ...history.get(),
    {
      role: "user",
      content: message,
    },
  ]);

  const openai = createOpenAI({
    baseURL: process.env.OPENAI_API_URL, // Allows to set API other than just openai's
    compatibility: 'compatible' // Allows Use of third party OpenAI APIS (Self hosted)
  })
  
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";

  const reply = await streamUI({
    model: openai(`${process.env.OPENAI_API_MODEL}`),
    messages: [
      { role: "system", content, toolInvocations: [] },
      ...history.get(),
    ] as CoreMessage[],
    initial: (
      <BotMessage className="items-center flex shrink-0 select-none justify-center">
        <Loader2 className="w-5 animate-spin stroke-zinc-900" />
      </BotMessage>
    ),
    text: ({ content, done }) => {
      if (done)
        history.done([...history.get(), { role: "assistant", content }]);
      return (
        <BotMessage>
          <ReactMarkdown>{content}</ReactMarkdown>
        </BotMessage>
      );
    },
    temperature: 0.5,
    tools: {
      get_job_details: {
        description: "Get job details for a specific job ID in Slurm.",
        parameters: z.object({
          job: z.string().describe("The Job ID of the job. e.g. 1234567"),
        }),
        generate: async function* ({ job }: { job: string }) {
          yield <BotCard>Getting job details for job {job}...</BotCard>;
          try {
            const response = await fetch(`${baseURL}/api/slurm/job/${job}`);
            if (!response.ok) {
              throw new Error(
                `Error fetching job details: ${response.statusText}`
              );
            }

            const jobDetails = await response.json();
            await sleep(1000);

            history.done([
              ...history.get(),
              {
                role: "assistant",
                name: "get_job_details",
                content: `[Details for Job = ${job}]`,
              },
            ]);

            return (
              <BotCard>
                <SlurmJobDetails job={jobDetails} />
              </BotCard>
            );
          } catch (error) {
            console.error(error);
            yield <BotCard>Error fetching job details.</BotCard>;
          }
        },
      },
      get_node_details: {
        description: "Get node details for a specific node in Slurm.",
        parameters: z.object({
          node: z.string().describe("The name of the node. e.g. node1"),
        }),
        generate: async function* ({ node }: { node: string }) {
          yield <BotCard>Getting node details for node {node}...</BotCard>;
          try {
            const response = await fetch(
              `${baseURL}/api/slurm/nodes/state/${node}`
            );
            if (!response.ok) {
              throw new Error(
                `Error fetching node details: ${response.statusText}`
              );
            }

            const nodeDetails = await response.json();
            await sleep(1000);

            history.done([
              ...history.get(),
              {
                role: "assistant",
                name: "get_node_details",
                content: `[Details for Node = ${node}]`,
              },
            ]);

            return (
              <BotCard>
                <SlurmNodeDetails node={nodeDetails} />
              </BotCard>
            );
          } catch (error) {
            console.error(error);
            yield <BotCard>Error fetching node details.</BotCard>;
          }
        },
      },
    },
  });

  return {
    id: Date.now(),
    role: "assistant",
    display: reply.value,
  };
};

export type AIState = Array<{
  id?: number;
  name?:
    | "get_job_details"
    | "explain_job_details"
    | "get_partition_details"
    | "get_node_details"
    | "get_queue_details"
    | "get_reservation_details"
    | "get_accounting_details"
    | "get_qos_details";
  role: "user" | "assistant" | "system";
  content: string;
}>;

export type UIState = Array<{
  id: number;
  role: "user" | "assistant";
  display: ReactNode;
  toolInvocations?: ToolInvocation[];
}>;

export const AI = createAI({
  initialAIState: [] as AIState,
  initialUIState: [] as UIState,
  actions: {
    sendMessage,
    clearHistory: async () => {
      const aiState = getMutableAIState<typeof AI>();
      aiState.update([]);
      return [];
    },
  },
});
