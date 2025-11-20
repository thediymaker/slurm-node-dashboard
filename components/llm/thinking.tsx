"use client";

import { Loader2 } from "lucide-react";
import { BotMessage } from "./message";

export function Thinking() {
  return (
    <BotMessage>
      <Loader2 className="h-4 w-4 animate-spin" />
    </BotMessage>
  );
}
