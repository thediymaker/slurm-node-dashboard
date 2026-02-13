"use client";
import { ChatList } from "@/components/llm/chat-list";
import ChatScrollAnchor from "@/components/llm/chat-scroll-anchor";
import { useEnterSubmit } from "@/lib/use-enter-submit";
import TextareaAutosize from "react-textarea-autosize";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ArrowUp, Trash2, X, Bot } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useEffect, useRef, useCallback, memo } from "react";
import { EmptyState } from "@/components/llm/empty-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useChat } from "@ai-sdk/react";

// Schema defined outside component - created once
const chatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
});

export type ChatInput = z.infer<typeof chatSchema>;

interface ChatModalProps {
  showChat: boolean;
  setShowChat: (show: boolean) => void;
}

function ChatModal({ showChat, setShowChat }: ChatModalProps) {
  const { messages, sendMessage, status, setMessages } = useChat({
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });
  
  const isLoading = status === 'submitted' || status === 'streaming';

  const form = useForm<ChatInput>({
    defaultValues: {
      message: ""
    }
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
    setMessages([]);
  }, [setMessages]);

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

  return (
    <Dialog open={showChat} onOpenChange={setShowChat}>
      <DialogContent className="sm:max-w-[1200px] w-[90vw] p-0 gap-0 overflow-hidden border shadow-xl h-[80vh] flex flex-col bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 [&>button]:hidden">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0 bg-background/50 backdrop-blur-sm">
          <DialogTitle className="text-sm font-medium flex items-center gap-3">
            <div className="flex items-center justify-center p-2 rounded-md bg-primary/10 border border-primary/20 shadow-sm">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold tracking-tight">Slurm Assistant</span>
              <span className="text-[10px] text-muted-foreground font-normal">AI-powered cluster insights</span>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={clearChatHistory}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Clear history</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear history</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setShowChat(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          {messages.length === 0 ? (
            <EmptyState setInput={handleSetInput} />
          ) : (
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            >
              <ChatList 
                messages={messages} 
                isLoading={isLoading} 
                onSelectFollowUp={handleFollowUp}
              />
              <ChatScrollAnchor />
            </div>
          )}
        </div>

        <div className="p-4 bg-background/50 border-t backdrop-blur-sm">
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(onSubmit)}
            className="relative flex items-end gap-2 p-2 border rounded-lg bg-muted/40 focus-within:bg-background/80 focus-within:ring-1 focus-within:ring-ring focus-within:border-primary/30 transition-all shadow-sm"
          >
            <TextareaAutosize
              tabIndex={0}
              onKeyDown={onKeyDown}
              placeholder="Ask anything..."
              className="min-h-[24px] w-full resize-none bg-transparent px-2 py-1.5 focus:outline-none text-sm max-h-32"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              rows={1}
              {...form.register("message")}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!form.watch("message") || isLoading}
              className="h-8 w-8 shrink-0 rounded-lg"
            >
              <ArrowUp className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <div className="text-[10px] text-center text-muted-foreground mt-2">
            AI can make mistakes. Check important info.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ChatModal);
