import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { ReactNode } from "react";

export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="group relative flex items-start justify-end gap-2 mb-4 pl-10">
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm inline-block float-right shadow-sm text-sm">
          {children}
        </div>
      </div>
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm mt-1">
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
    <div className={cn("group relative flex items-start gap-2 mb-4 pr-10", className)}>
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted border shadow-sm mt-1">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm inline-block shadow-sm text-sm prose dark:prose-invert max-w-none break-words">
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
    <div className="group relative flex items-start gap-2 mb-4 pr-10">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted border shadow-sm mt-1",
          !showAvatar && "invisible"
        )}
      >
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="bg-card border px-4 py-3 rounded-xl shadow-sm text-sm w-full">
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
