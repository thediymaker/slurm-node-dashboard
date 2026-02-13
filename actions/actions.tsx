"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "process";

const openai = createOpenAI({
  baseURL: env.OPENAI_API_URL,
  apiKey: env.OPENAI_API_KEY,
});

export async function generateFollowUpQuestions(
  userMessage: string,
  assistantMessage: string
) {
  const maxRetries = 2;

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
        prompt: `Based on the following conversation, generate exactly 3 short, relevant follow-up questions that the user might want to ask next.
The questions should be specific to Slurm, HPC, or the context of the previous answer.
Keep them concise (under 10 words each).
You MUST respond with valid JSON matching this schema: { "questions": ["q1", "q2", "q3"] }

User: ${userMessage}
Assistant: ${assistantMessage}`,
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

