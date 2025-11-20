"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  node?: any;
}

export function CodeBlock({ className, children, node, ...props }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  const onCopy = () => {
    if (isCopied) return;
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <div className="relative my-4 overflow-hidden rounded-lg border bg-zinc-950 text-zinc-50">
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-400 uppercase">
          {language || "text"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
          onClick={onCopy}
        >
          {isCopied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span className="sr-only">Copy code</span>
        </Button>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="font-mono text-sm">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}
