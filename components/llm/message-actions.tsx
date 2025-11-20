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
}

export function MessageActions({ message, isLoading, isLast, reload }: MessageActionsProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);

  const handleCopy = () => {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Cast message to any to access usage if it exists on the runtime object but not in the type definition yet
  const usage = (message as any).usage;

  return (
    <div className="flex items-center gap-1 mt-2 -ml-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => setFeedback(feedback === 'good' ? null : 'good')}
        title="Good response"
      >
        <ThumbsUp className={cn("h-3.5 w-3.5", feedback === 'good' && "fill-current text-green-500")} />
        <span className="sr-only">Good</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => setFeedback(feedback === 'bad' ? null : 'bad')}
        title="Bad response"
      >
        <ThumbsDown className={cn("h-3.5 w-3.5", feedback === 'bad' && "fill-current text-red-500")} />
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
                {(usage.completionTokensDetails?.reasoningTokens || (usage as any).reasoningTokens) && (
                   <>
                    <span className="text-muted-foreground">Reasoning:</span>
                    <span className="text-right font-mono">
                        {usage.completionTokensDetails?.reasoningTokens || (usage as any).reasoningTokens}
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
