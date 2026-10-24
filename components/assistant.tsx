"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import ChatModal from "@/components/modals/chat-modal";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/components/runtime-config";
import { cn } from "@/lib/utils";

// One assistant panel for the whole app: the header opens it, and node and job
// views can open it with a question already asked
interface AssistantContextValue {
  enabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  ask: (question: string) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const enabled = useFeature("ai");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const ask = useCallback((question: string) => {
    setPending(question);
    setOpen(true);
  }, []);
  const clearPending = useCallback(() => setPending(null), []);

  const value = useMemo(() => ({ enabled, open, setOpen, ask }), [enabled, open, ask]);

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {enabled && (
        <ChatModal showChat={open} setShowChat={setOpen} pendingPrompt={pending} onPromptSent={clearPending} />
      )}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside AssistantProvider");
  return value;
}

// "Ask the assistant" for a node or job; renders nothing when the assistant is off
export function AskAssistantButton({
  question,
  label = "Ask the assistant",
  onAsk,
  className,
}: {
  question: string;
  label?: string;
  // Runs first, e.g. to close the dialog the button sits in
  onAsk?: () => void;
  className?: string;
}) {
  const { enabled, ask } = useAssistant();
  if (!enabled) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 text-[13px] font-normal", className)}
      onClick={() => {
        onAsk?.();
        ask(question);
      }}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
