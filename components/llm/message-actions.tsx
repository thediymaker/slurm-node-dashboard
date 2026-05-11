"use client";

import { Button } from "@/components/ui/button";
import { 
  Copy, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown, 
  Info,
  Check
} from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UIMessage } from "ai";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  message: UIMessage;
  isLoading: boolean;
  isLast: boolean;
  reload?: () => void;
  onRequestFeedback?: (rating?: number) => void;
}

interface MessageUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  completionTokensDetails?: {
    reasoningTokens?: number;
  };
  reasoningTokens?: number;
}

interface MessageWithUsage extends UIMessage {
  usage?: MessageUsage;
}

export function MessageActions({
  message,
  isLoading,
  isLast,
  reload,
  onRequestFeedback,
}: MessageActionsProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    const text = message.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const usage = (message as MessageWithUsage).usage;
  const reasoningTokens =
    usage?.completionTokensDetails?.reasoningTokens || usage?.reasoningTokens;

  return (
    <div className="flex items-center gap-1 mt-2 -ml-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => onRequestFeedback?.(5)}
        title="Good response"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span className="sr-only">Good</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => onRequestFeedback?.(1)}
        title="Bad response"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span className="sr-only">Bad</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        title="Copy response"
      >
        {isCopied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        <span className="sr-only">Copy</span>
      </Button>

      {isLast && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => reload && reload()}
          disabled={isLoading || !reload}
          title="Regenerate response"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          <span className="sr-only">Regenerate</span>
        </Button>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Token details"
            disabled={!usage}
          >
            <Info className="h-3.5 w-3.5" />
            <span className="sr-only">Token details</span>
          </Button>
        </PopoverTrigger>
        {usage && (
          <PopoverContent className="w-64 p-3 text-xs" align="start">
            <div className="grid gap-2">
              <div className="font-medium border-b pb-1 mb-1">Token Usage</div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Prompt:</span>
                <span className="text-right font-mono">{usage.promptTokens}</span>
                
                <span className="text-muted-foreground">Completion:</span>
                <span className="text-right font-mono">{usage.completionTokens}</span>
                
                <span className="text-muted-foreground">Total:</span>
                <span className="text-right font-mono">{usage.totalTokens}</span>

                {/* Check for reasoning tokens in various possible locations */}
                {reasoningTokens && (
                   <>
                    <span className="text-muted-foreground">Reasoning:</span>
                    <span className="text-right font-mono">
                        {reasoningTokens}
                    </span>
                   </>
                )}
              </div>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
