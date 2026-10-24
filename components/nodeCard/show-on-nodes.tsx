"use client";

import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Opens the nodes page with a user's or job's nodes highlighted
export function ShowOnNodesButton({
  user,
  job,
  onShow,
  className,
}: {
  user?: string;
  job?: string;
  // Runs first, e.g. to close the dialog the button sits in
  onShow?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const query = user ? `user=${encodeURIComponent(user)}` : job ? `job=${encodeURIComponent(job)}` : null;
  if (!query) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 text-[13px] font-normal", className)}
      onClick={() => {
        onShow?.();
        router.push(`/?${query}`);
      }}
    >
      <LocateFixed className="h-3.5 w-3.5" />
      Show on nodes
    </Button>
  );
}
