import { cn } from "@/lib/utils";
import { SparkleIcon, SparklesIcon, UserIcon } from "lucide-react";
import { ReactNode } from "react";

export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="group relative flex items-center md:ml-0">
      <div className="flex h-8 shrink-0 select-none items-center justify-center rounded-md border shadow-sm bg-background w-8">
        <UserIcon />
      </div>
      <div className="ml-4 w-full flex-1 text-sm space-y-2 overflow-hidden prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-4 px-1 text-gray-300">
        {children}
      </div>
    </div>
  );
}

export function BotMessage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group relative flex items-center md:ml-0", className)}>
      <div className="flex h-8 shrink-0 select-none items-center justify-center rounded-md border shadow-sm bg-background w-8">
        <SparklesIcon />
      </div>
      <div className="ml-4 flex-1 space-y-2 text-sm overflow-hidden px-1 prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-4 w-full text-gray-500">
        {children}
      </div>
    </div>
  );
}

export function BotCard({
  children,
  showAvatar = true,
}: {
  children: ReactNode;
  showAvatar?: boolean;
}) {
  return (
    <div className="group relative flex items-start md:ml-0">
      {showAvatar && (
        <div
          className={cn(
            "flex h-8 shrink-0 select-none items-center justify-center rounded-md border shadow-sm bg-background w-8",
            !showAvatar && "invisible"
          )}
        >
          <SparklesIcon />
        </div>
      )}
      <div className="ml-4 w-full flex-1 space-y-2 text-sm overflow-hidden px-1 prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-4 text-gray-400">
        {children}
      </div>
    </div>
  );
}

export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-2 text-xs prose break-words text-gray-500">
      <div className="w-full flex-initial p-2 text-sm dark:prose-invert prose-p:leading-relaxed prose-pre:p-4">
        {children}
      </div>
    </div>
  );
}
