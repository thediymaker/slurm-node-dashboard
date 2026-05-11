"use client";

import { useMemo, useState } from "react";
import type { UIMessage } from "ai";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatFeedbackProps {
  messages: UIMessage[];
  chatKey: string;
  open: boolean;
  rating: number | null;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (rating: number | null) => void;
}

export function ChatFeedback({
  messages,
  chatKey,
  open,
  rating,
  disabled,
  onOpenChange,
  onRatingChange,
}: ChatFeedbackProps) {
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentChatKey, setSentChatKey] = useState<string | null>(null);
  const hasMessages = messages.length > 0;
  const sent = sentChatKey === chatKey;
  const promptText = useMemo(
    () =>
      sent
        ? "Thanks for the feedback."
        : "Would you like to leave feedback for this chat?",
    [sent]
  );

  function openFeedbackDialog() {
    setError(null);
    onOpenChange(true);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setError(null);
    }

    onOpenChange(nextOpen);
  }

  async function submitFeedback() {
    if (!rating || isSubmitting || !hasMessages) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          details,
          messages,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send feedback.");
      }

      setSentChatKey(chatKey);
      onOpenChange(false);
      onRatingChange(null);
      setDetails("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasMessages) {
    return null;
  }

  return (
    <>
      <div className="mb-2 flex flex-col gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{promptText}</span>
        {!sent && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1.5 self-start px-2 text-xs sm:self-auto"
            onClick={openFeedbackDialog}
            disabled={disabled}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Leave feedback
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Feedback</DialogTitle>
            <DialogDescription>
              Your rating, notes, and the current chat transcript will be sent
              to the configured Slack feedback channel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Rating</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => onRatingChange(value)}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        rating && value <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      )}
                    />
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="chat-feedback-details">
                Details
              </label>
              <Textarea
                id="chat-feedback-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="What went well or what should we fix?"
                className="min-h-32 resize-y"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitFeedback}
              disabled={!rating || isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
