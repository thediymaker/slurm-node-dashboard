"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import type { FollowUpContextInput } from "@/lib/follow-up-context";

const env = process.env;

const openai = createOpenAI({
  baseURL: env.OPENAI_API_URL,
  apiKey: env.OPENAI_API_KEY,
});

const followUpContextSchema = z.object({
  userMessage: z.string(),
  assistantText: z.string(),
  toolContext: z.string().optional(),
  toolGuidance: z.string().optional(),
  toolNames: z.array(z.string()),
  hasToolOutput: z.boolean(),
});

export async function generateFollowUpQuestions(context: FollowUpContextInput) {
  const maxRetries = 2;
  const normalizedContext = followUpContextSchema.parse(context);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { output } = await generateText({
        model: openai.chat(
          env.OPENAI_API_MODEL_SUGGESTION ||
            env.OPENAI_API_MODEL ||
            "gpt-3.5-turbo"
        ),
        output: Output.object({
          schema: z.object({
            questions: z.array(z.string()).min(1).max(5),
          }),
        }),
            prompt: `Based on the following conversation and structured tool context, generate exactly 3 short, relevant follow-up questions that the user might want to ask next.
          The questions should be specific to Slurm, HPC, or the context of the previous answer.
Keep them concise (under 10 words each).
          If structured tool context or tool guidance is present, use it as the primary source of truth for follow-up ideas.
Honor the configured tool guidance. Do not invent tool-specific policy that is not present in the context.
You MUST respond with valid JSON matching this schema: { "questions": ["q1", "q2", "q3"] }

          User: ${normalizedContext.userMessage}
          Assistant text: ${normalizedContext.assistantText || "(none)"}
          Tool context: ${normalizedContext.toolContext || "(none)"}
          Tool guidance: ${normalizedContext.toolGuidance || "(none)"}
          Tools used: ${normalizedContext.toolNames.join(", ") || "(none)"}
          Has tool output: ${normalizedContext.hasToolOutput ? "true" : "false"}`,
      });

      if (!output || !output.questions || output.questions.length === 0) {
        if (attempt < maxRetries) continue;
        return [];
      }

      return output.questions.slice(0, 3);
    } catch (error) {
      if (attempt < maxRetries) continue;
      console.error("Error generating follow-up questions:", error);
      return [];
    }
  }

  return [];
}
