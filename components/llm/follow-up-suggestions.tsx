"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FollowUpSuggestionsProps {
  questions: string[];
  onSelect?: (question: string) => void;
}

export function FollowUpSuggestions({ questions, onSelect }: FollowUpSuggestionsProps) {
  const handleClick = (question: string) => {
    if (onSelect) {
      onSelect(question);
    }
  };

  if (!questions || questions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-4">
      <div className="text-xs text-muted-foreground font-medium">
        Suggested follow-ups:
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-2 px-3 text-left whitespace-normal text-xs justify-start"
            onClick={() => handleClick(question)}
          >
            {question}
            <ArrowRight className="w-3 h-3 ml-2 opacity-50" />
          </Button>
        ))}
      </div>
    </div>
  );
}

