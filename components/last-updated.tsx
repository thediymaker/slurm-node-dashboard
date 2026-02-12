import { useEffect, useState, useRef } from "react";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import { cn } from "@/lib/utils";
import { RefreshCw, XCircle } from "lucide-react";

const REFRESH_INTERVAL_MS = 45000; // 45 seconds to match typical refresh rate
const STALE_THRESHOLD_SECONDS = 60; // 1 minute - data is stale if older than this
const UPDATE_INTERVAL_MS = 1000; // Update progress every second (less frequent)

interface LastUpdatedProps {
  data: number | null | undefined;
  hasConnectionError?: boolean;
}

export const LastUpdated = ({ data, hasConnectionError }: LastUpdatedProps) => {
  const [progress, setProgress] = useState(100);
  const [isDataStale, setIsDataStale] = useState(false);

  // Use ref to track receive time to avoid stale closures
  const receiveTimeRef = useRef(Date.now());
  const prevDataRef = useRef(data);

  // Convert lastDataTime to human readable for display
  const lastUpdate: string = convertUnixToHumanReadable(data) || "—";

  // Detect when new data arrives - just reset the timer, no animation
  useEffect(() => {
    if (data !== prevDataRef.current && data != null) {
      prevDataRef.current = data;
      receiveTimeRef.current = Date.now();
      setProgress(100);
    }
  }, [data]);

  // Update progress and staleness check on interval
  useEffect(() => {
    const updateState = () => {
      const now = Date.now();
      const elapsed = now - receiveTimeRef.current;

      // Update progress bar smoothly
      const percentage = Math.max(0, ((REFRESH_INTERVAL_MS - elapsed) / REFRESH_INTERVAL_MS) * 100);
      setProgress(percentage);

      // Check staleness based on data timestamp
      if (data != null && typeof data === "number") {
        const dataAgeSeconds = (now / 1000) - data;
        setIsDataStale(dataAgeSeconds > STALE_THRESHOLD_SECONDS);
      } else {
        setIsDataStale(false);
      }
    };

    // Run immediately
    updateState();

    // Then run on interval
    const intervalId = setInterval(updateState, UPDATE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [data]);

  return (
    <div
      className={cn(
        "fixed bottom-14 left-1/2 -translate-x-1/2 z-40",
        "flex items-center gap-3 px-3 py-1.5",
        "bg-background/80 backdrop-blur-md border shadow-sm rounded-full",
        "transition-all duration-300 ease-in-out hover:bg-background/90 hover:shadow-md",
        "select-none",
        (hasConnectionError || isDataStale) && "border-destructive/50",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
        {hasConnectionError || isDataStale ? (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <RefreshCw className="h-3 w-3 opacity-50" />
        )}
        <span className="tabular-nums">
          {hasConnectionError ? (
            <span className="text-destructive">
              Using cached data • <span className="underline">Please refresh</span>
            </span>
          ) : (
            <>Updated: <span className={cn(
              "text-foreground", 
              isDataStale && "text-destructive"
            )}>{lastUpdate}</span></>
          )}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-24 bg-muted/50 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            (hasConnectionError || isDataStale) ? "bg-destructive" :
            "bg-primary/60"
          )}
          style={{ 
            width: (hasConnectionError || isDataStale)
              ? "100%" 
              : `${progress}%` 
          }}
        />
      </div>
    </div>
  );
};
