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
  try {
    const { output } = await generateText({
      model: openai.chat(
        env.OPENAI_API_MODEL_SUGGESTION ||
          env.OPENAI_API_MODEL ||
          "gpt-3.5-turbo"
      ),
      output: Output.object({
        schema: z.object({
          questions: z.array(z.string()).length(3),
        }),
      }),
      prompt: `
        Based on the following conversation, generate 3 short, relevant follow-up questions that the user might want to ask next.
        The questions should be specific to Slurm, HPC, or the context of the previous answer.
        Keep them concise (under 10 words).

        User: ${userMessage}
        Assistant: ${assistantMessage}
      `,
    });

    return output!.questions;
  } catch (error) {
    console.error("Error generating follow-up questions:", error);
    return [];
  }
}

