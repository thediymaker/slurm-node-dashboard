"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ToolTurnDetails, ToolTurnDetailTone } from "@/lib/tool-turn-ui";

const TONE_STYLES: Record<ToolTurnDetailTone, string> = {
  default: "text-foreground",
  info: "text-primary",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

interface ToolTurnDetailsProps {
  details: ToolTurnDetails;
}

function ToolTurnDetailsComponent({ details }: ToolTurnDetailsProps) {
  const hasItems = Array.isArray(details.items) && details.items.length > 0;
  const hasNotes = Array.isArray(details.notes) && details.notes.length > 0;

  if (!details.title && !details.intro && !hasItems && !hasNotes) {
    return null;
  }

  return (
    <div className="space-y-3">
      {details.title && (
        <h3 className="text-sm font-semibold tracking-tight">{details.title}</h3>
      )}
      {details.intro && (
        <p className="text-sm text-muted-foreground">{details.intro}</p>
      )}
      {hasItems && (
        <div className="space-y-2">
          {details.items?.map((item) => (
            <div key={`${item.label}-${item.value}`} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {item.label}
              </div>
              <div
                className={cn(
                  "mt-1 text-sm",
                  TONE_STYLES[item.tone || "default"],
                  item.code && "font-mono"
                )}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {hasNotes && (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {details.notes?.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const ToolTurnDetailsBlock = memo(ToolTurnDetailsComponent);