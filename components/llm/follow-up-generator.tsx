"use client";

import { useEffect, useState } from "react";
import { FollowUpSuggestions } from "./follow-up-suggestions";
import { generateFollowUpQuestions } from "@/actions/actions";
import type { FollowUpContextInput } from "@/lib/follow-up-context";

interface FollowUpGeneratorProps {
  context: FollowUpContextInput | null;
  onSelect?: (question: string) => void;
}

export function FollowUpGenerator({
  context,
  onSelect,
}: FollowUpGeneratorProps) {
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (!context?.userMessage) return;
    if (
      !context.assistantText &&
      !context.toolContext &&
      !context.toolGuidance &&
      !context.hasToolOutput &&
      context.toolNames.length === 0
    ) {
      return;
    }

    const fetchQuestions = async () => {
      try {
        const qs = await generateFollowUpQuestions(context);
        setQuestions(qs);
      } catch (error) {
        console.error("Failed to generate follow-up questions:", error);
      }
    };
    fetchQuestions();
  }, [context]);

  if (questions.length === 0) return null;

  return <FollowUpSuggestions questions={questions} onSelect={onSelect} />;
}

