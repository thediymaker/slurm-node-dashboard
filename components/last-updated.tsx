import { useEffect, useState, useRef, useCallback } from "react";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import { cn } from "@/lib/utils";
import { RefreshCw, XCircle, Gamepad2 } from "lucide-react";

const REFRESH_INTERVAL_MS = 45000; // 45 seconds to match typical refresh rate
const STALE_THRESHOLD_SECONDS = 1800; // 30 minutes
const UPDATE_INTERVAL_MS = 1000; // Update progress every second (less frequent)
const EASTER_EGG_CLICKS = 5;
const CLICK_RESET_DELAY = 2000; // Reset click count after 2 seconds of no clicks

interface LastUpdatedProps {
  data: number | null | undefined;
  onEasterEgg?: () => void;
}

export const LastUpdated = ({ data, onEasterEgg }: LastUpdatedProps) => {
  const [progress, setProgress] = useState(100);
  const [isDataStale, setIsDataStale] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const clickResetTimeoutRef = useRef<NodeJS.Timeout>();

  const handleClick = useCallback(() => {
    // Clear existing timeout
    if (clickResetTimeoutRef.current) {
      clearTimeout(clickResetTimeoutRef.current);
    }

    const newCount = clickCount + 1;
    setClickCount(newCount);

    // Show hint after 3 clicks
    if (newCount >= 3 && newCount < EASTER_EGG_CLICKS) {
      setShowHint(true);
    }

    // Trigger easter egg
    if (newCount >= EASTER_EGG_CLICKS) {
      setClickCount(0);
      setShowHint(false);
      onEasterEgg?.();
      return;
    }

    // Reset after delay
    clickResetTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
      setShowHint(false);
    }, CLICK_RESET_DELAY);
  }, [clickCount, onEasterEgg]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickResetTimeoutRef.current) {
        clearTimeout(clickResetTimeoutRef.current);
      }
    };
  }, []);

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
      onClick={handleClick}
      className={cn(
        "fixed bottom-14 left-1/2 -translate-x-1/2 z-40",
        "flex items-center gap-3 px-3 py-1.5",
        "bg-background/80 backdrop-blur-md border shadow-sm rounded-full",
        "transition-all duration-300 ease-in-out hover:bg-background/90 hover:shadow-md",
        "cursor-pointer select-none",
        isDataStale && "border-destructive/50 bg-destructive/10",
        clickCount > 0 && "scale-105",
        showHint && "animate-pulse"
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
        {showHint ? (
          <Gamepad2 className="h-3.5 w-3.5 text-primary animate-bounce" />
        ) : isDataStale ? (
          <XCircle className="h-3.5 w-3.5 text-destructive animate-pulse" />
        ) : (
          <RefreshCw className="h-3 w-3 opacity-50" />
        )}
        <span className="tabular-nums">
          {showHint ? (
            <span className="text-primary">{EASTER_EGG_CLICKS - clickCount} more...</span>
          ) : (
            <>Updated: <span className={cn("text-foreground", isDataStale && "text-destructive font-bold")}>{lastUpdate}</span></>
          )}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-24 bg-muted/50 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            showHint ? "bg-primary" : isDataStale ? "bg-destructive" : "bg-primary/60"
          )}
          style={{ 
            width: showHint 
              ? `${(clickCount / EASTER_EGG_CLICKS) * 100}%` 
              : isDataStale 
                ? "100%" 
                : `${progress}%` 
          }}
        />
      </div>
    </div>
  );
};
