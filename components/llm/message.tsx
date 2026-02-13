import { cn } from "@/lib/utils";
import { User, Sparkles, Bot } from "lucide-react";
import { ReactNode } from "react";

export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="group relative flex items-start justify-end gap-3 mb-6 pl-12">
      <div className="flex-1 space-y-2 overflow-hidden flex flex-col items-end">
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-sm text-sm">
          {children}
        </div>
      </div>
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm mt-0.5">
        <User className="h-4 w-4" />
      </div>
    </div>
  );
}

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
    <div className={cn("group relative flex items-start gap-3 mb-6 pr-12", className)}>
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shadow-sm mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="bg-muted/50 border px-4 py-3 rounded-lg shadow-sm text-sm prose dark:prose-invert max-w-none break-words">
          {children}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function BotCard({
  children,
  showAvatar = true,
  action,
}: {
  children: ReactNode;
  showAvatar?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="group relative flex items-start gap-3 mb-6 pr-12">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shadow-sm mt-0.5",
          !showAvatar && "invisible"
        )}
      >
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="bg-muted/30 border px-4 py-3 rounded-lg shadow-sm text-sm w-full mx-0">
          {children}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
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
