import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { loadLLMConfig, buildToolsAndPrompt } from "@/lib/llm-config";
import { env } from "process";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const openai = createOpenAI({
    baseURL: process.env.OPENAI_API_URL,
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Build tools and system prompt dynamically from the YAML config
  const config = await loadLLMConfig();
  const { tools, systemPrompt } = buildToolsAndPrompt(config);

  const toolNames = Object.keys(tools);

  const result = await streamText({
    model: openai.chat(env.OPENAI_API_MODEL || "gpt-3.5-turbo"),
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    tools,
    stopWhen: stepCountIs(5),
    prepareStep: ({ stepNumber }) => {
      // On the first step, force tool calls only — no text generation.
      // This prevents the model from hallucinating data before tools return.
      if (stepNumber === 0 && toolNames.length > 0) {
        return { toolChoice: "required" as const, activeTools: toolNames };
      }
      return { toolChoice: "auto" as const };
    },
  });

  return result.toUIMessageStreamResponse();
}
