import { cn } from "@/lib/utils";
import { ReactNode } from "react";

// User turns are right-aligned bubbles
export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="group relative mb-4 flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// Assistant text reads as plain text, without a bubble
export function BotMessage({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("group relative mb-3", className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none break-words text-sm leading-relaxed prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Tool results: a compact card. The tool components bring their own card,
// so its border, shadow and rounding give way to this one.
export function BotCard({
  children,
  action,
}: {
  children: ReactNode;
  showAvatar?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="group relative mb-3">
      <div className="w-full overflow-hidden rounded-lg border bg-card text-sm [&>.border]:rounded-none [&>.border]:border-0 [&>.border]:shadow-none [&_.p-4]:p-3">
        {children}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground my-4">
      <div className="flex-initial px-2 py-1 rounded-full bg-muted border">
        {children}
      </div>
    </div>
  );
}
