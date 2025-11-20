"use client";

import { useEffect, useState } from "react";
import { FollowUpSuggestions } from "./follow-up-suggestions";
import { generateFollowUpQuestions } from "@/actions/actions";

interface FollowUpGeneratorProps {
  userMessage: string;
  assistantMessage: string;
  onSelect?: (question: string) => void;
}

export function FollowUpGenerator({
  userMessage,
  assistantMessage,
  onSelect,
}: FollowUpGeneratorProps) {
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (!userMessage || !assistantMessage) return;

    const fetchQuestions = async () => {
      try {
        const qs = await generateFollowUpQuestions(userMessage, assistantMessage);
        setQuestions(qs);
      } catch (error) {
        console.error("Failed to generate follow-up questions:", error);
      }
    };
    fetchQuestions();
  }, [userMessage, assistantMessage]);

  if (questions.length === 0) return null;

  return <FollowUpSuggestions questions={questions} onSelect={onSelect} />;
}

