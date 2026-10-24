"use client";
import { ChatList } from "@/components/llm/chat-list";
import ChatScrollAnchor from "@/components/llm/chat-scroll-anchor";
import { useEnterSubmit } from "@/lib/use-enter-submit";
import TextareaAutosize from "react-textarea-autosize";
import { type SubmitHandler, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ArrowUp, Plus, X, MessageCircle, Square, Maximize2, Minimize2 } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useCallback, memo, useMemo, useState } from "react";
import { EmptyState } from "@/components/llm/empty-state";
import { ChatFeedback } from "@/components/llm/chat-feedback";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { withBasePath } from "@/lib/base-path";
import { useRuntimeConfig } from "@/components/runtime-config";
import { cn } from "@/lib/utils";

export interface ChatInput {
  message: string;
}

interface ChatModalProps {
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  // A question to send as soon as the panel is open, e.g. from a node's "Ask the assistant"
  pendingPrompt?: string | null;
  onPromptSent?: () => void;
}

function createChatId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const chatTransport = new DefaultChatTransport({ api: withBasePath("/api/chat") });

// The assistant, docked on the right over a lightly dimmed page
function ChatModal({ showChat, setShowChat, pendingPrompt, onPromptSent }: ChatModalProps) {
  const { assistantModel } = useRuntimeConfig();
  const [expanded, setExpanded] = useState(false);
  const [chatId, setChatId] = useState(createChatId);
  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: chatId,
    transport: chatTransport,
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });
  
  const isLoading = status === 'submitted' || status === 'streaming';
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const chatFeedbackKey = useMemo(
    () => messages.map((message) => message.id).join("|"),
    [messages]
  );

  const form = useForm<ChatInput>({
    defaultValues: {
      message: ""
    }
  });
  const currentMessage = useWatch({
    control: form.control,
    name: "message",
  });
  
  const { formRef, onKeyDown } = useEnterSubmit();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const onSubmit: SubmitHandler<ChatInput> = useCallback(
    async (data) => {
      const value = data.message.trim();
      if (!value || isLoading) return;

      form.setValue("message", "");

      try {
        await sendMessage({
          text: value,
        });
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    },
    [form, sendMessage, isLoading]
  );

  const clearChatHistory = useCallback(() => {
    void stop();
    setFeedbackOpen(false);
    setFeedbackRating(null);
    setMessages([]);
    setChatId(createChatId());
  }, [setMessages, stop]);

  useEffect(() => {
    if (!showChat || !pendingPrompt || isLoading) return;
    onPromptSent?.();
    sendMessage({ text: pendingPrompt }).catch((error) => {
      console.error('Failed to send message:', error);
    });
  }, [showChat, pendingPrompt, isLoading, sendMessage, onPromptSent]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFollowUp = useCallback(
    (question: string) => {
      if (isLoading) return;
      sendMessage({
        text: question,
      }).catch((error) => {
        console.error('Failed to send follow-up:', error);
      });
    },
    [sendMessage, isLoading]
  );

  const handleSetInput = useCallback(
    (val: string) => {
      form.setValue("message", val);
    },
    [form]
  );

  const handleRequestFeedback = useCallback((rating?: number) => {
    setFeedbackRating(rating || null);
    setFeedbackOpen(true);
  }, []);

  const handleStopGeneration = useCallback(() => {
    void stop();
  }, [stop]);

  const handleFeedbackOpenChange = useCallback((open: boolean) => {
    if (open) {
      setFeedbackRating(null);
    }
    setFeedbackOpen(open);
  }, []);

  return (
    <DialogPrimitive.Root open={showChat} onOpenChange={setShowChat}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed bottom-3 right-3 top-3 z-50 flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl",
            "transition-[width] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-8 data-[state=open]:slide-in-from-right-8",
            expanded ? "w-[min(900px,calc(100vw-24px))]" : "w-[min(460px,calc(100vw-24px))]"
          )}
        >
          {/* Header */}
          <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b pl-4 pr-2.5">
            <MessageCircle className="h-[18px] w-[18px] shrink-0" style={{ color: "hsl(var(--chart-1))" }} />
            <DialogPrimitive.Title className="text-sm font-semibold">Assistant</DialogPrimitive.Title>
            {assistantModel && (
              <span
                className="min-w-0 truncate rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                title={assistantModel}
              >
                {assistantModel}
              </span>
            )}
            <div className="flex-1" />
            <TooltipProvider>
              <HeaderButton label="New conversation" onClick={clearChatHistory}>
                <Plus className="h-4 w-4" />
              </HeaderButton>
              <HeaderButton
                label={expanded ? "Collapse" : "Expand"}
                onClick={() => setExpanded((e) => !e)}
                className="hidden sm:inline-flex"
              >
                {expanded ? <Minimize2 className="h-[15px] w-[15px]" /> : <Maximize2 className="h-[15px] w-[15px]" />}
              </HeaderButton>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close assistant</span>
                </Button>
              </DialogPrimitive.Close>
            </TooltipProvider>
          </div>

          {/* Messages */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {messages.length === 0 ? (
              <EmptyState setInput={handleSetInput} />
            ) : (
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-4 py-[18px] scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
              >
                <ChatList 
                  messages={messages} 
                  isLoading={isLoading} 
                  onSelectFollowUp={handleFollowUp}
                  onRequestFeedback={handleRequestFeedback}
                />
                <ChatScrollAnchor />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t p-3">
            <ChatFeedback
              messages={messages}
              chatKey={chatFeedbackKey}
              open={feedbackOpen}
              rating={feedbackRating}
              disabled={isLoading}
              onOpenChange={handleFeedbackOpenChange}
              onRatingChange={setFeedbackRating}
            />
            <form
              ref={formRef}
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-2 rounded-xl border bg-muted/30 py-2.5 pl-3 pr-2.5 transition-colors focus-within:border-ring/40 focus-within:bg-background"
            >
              <label htmlFor="assistant-message" className="sr-only">
                Message the assistant
              </label>
              <TextareaAutosize
                id="assistant-message"
                tabIndex={0}
                onKeyDown={onKeyDown}
                placeholder="Ask about nodes, jobs, partitions, reservations…"
                className="max-h-40 min-h-[42px] w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none"
                autoFocus
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                minRows={2}
                {...form.register("message")}
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">AI can make mistakes. Check important info.</span>
                <div className="flex-1" />
                <span className="hidden text-[11px] text-muted-foreground sm:inline">Enter to send</span>
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={handleStopGeneration}
                    className="h-[30px] w-[30px] shrink-0 rounded-lg"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span className="sr-only">Stop generating</span>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!currentMessage}
                    className="h-[30px] w-[30px] shrink-0 rounded-lg"
                  >
                    <ArrowUp className="h-4 w-4" />
                    <span className="sr-only">Send</span>
                  </Button>
                )}
              </div>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function HeaderButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-muted-foreground", className)} onClick={onClick}>
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default memo(ChatModal);
