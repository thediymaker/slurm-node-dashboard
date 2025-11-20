"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  baseURL: process.env.OPENAI_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateFollowUpQuestions(
  userMessage: string,
  assistantMessage: string
) {
  try {
    const { object } = await generateObject({
      model: openai.chat(
        process.env.OPENAI_API_MODEL_SUGGESTION ||
          process.env.OPENAI_API_MODEL ||
          "gpt-3.5-turbo"
      ),
      schema: z.object({
        questions: z.array(z.string()).length(3),
      }),
      prompt: `
        Based on the following conversation, generate 3 short, relevant follow-up questions that the user might want to ask next.
        The questions should be specific to Slurm, HPC, or the context of the previous answer.
        Keep them concise (under 10 words).

        User: ${userMessage}
        Assistant: ${assistantMessage}
      `,
    });

    return object.questions;
  } catch (error) {
    console.error("Error generating follow-up questions:", error);
    return [];
  }
}

