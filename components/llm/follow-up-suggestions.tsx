"use client";

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
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
      {questions.map((question, index) => (
        <button
          key={index}
          type="button"
          className="rounded-full border bg-card px-3 py-1.5 text-left text-xs text-foreground/90 transition-colors hover:border-ring/40 hover:bg-muted/60"
          onClick={() => handleClick(question)}
        >
          {question}
        </button>
      ))}
    </div>
  );
}
