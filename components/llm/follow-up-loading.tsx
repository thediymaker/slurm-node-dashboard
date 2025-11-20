"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const loadingMessages = [
  "Consulting the Slurm oracle...",
  "Calculating optimal trajectory for conversation...",
  "Parsing the matrix for intelligent suggestions...",
  "Asking the scheduler for a priority boost...",
  "Compiling witty retorts...",
  "Grepping the universe for answers...",
  "Allocating resources for your next question...",
  "Checking partition limits for curiosity...",
  "Backfilling the conversation queue...",
  "Waiting for resources to allocate for your next thought...",
  "Job queued: generating brilliance...",
  "Preempting lower priority thoughts...",
  "Checking QoS limits for wit...",
  "Draining the node for maintenance... just kidding, thinking...",
  "Submitting batch job for follow-up questions...",
  "Requesting exclusive access to the idea partition...",
  "Nice-adjusting the conversation priority...",
  "Checking association limits for creativity...",
  "Expanding the job array of possibilities...",
];

export function FollowUpLoading() {
  const [message, setMessage] = useState(loadingMessages[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div className="text-xs font-medium text-muted-foreground">Suggested Follow-ups</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>{message}</span>
      </div>
    </div>
  );
}
