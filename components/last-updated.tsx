import { useEffect, useState } from "react";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import { Progress } from "./ui/progress";

export const LastUpdated = ({ data }: any) => {
  const [progress, setProgress] = useState(100);
  const [lastDataTime, setLastDataTime] = useState(data);

  // Convert lastDataTime to milliseconds for display purposes
  const lastUpdate: string = convertUnixToHumanReadable(lastDataTime) || "";

  useEffect(() => {
    if (data !== lastDataTime) {
      setLastDataTime(data);
      setProgress(100); // Reset progress to 100% when new data is received
    }
  }, [data, lastDataTime]);

  useEffect(() => {
    const updateProgress = () => {
      const currentTimeInSeconds = Date.now() / 1000;
      const elapsedSeconds = currentTimeInSeconds - lastDataTime;
      if (elapsedSeconds >= 45) {
        setProgress(100); // Stay at 100% if the elapsed time is greater than 30 seconds
      } else {
        const newProgress = ((45 - elapsedSeconds) / 45) * 100;
        setProgress(newProgress);
      }
    };

    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [lastDataTime]);

  return (
    <div className="fixed inset-x-0 bottom-16 text-sm font-light text-center p-2 border-2 bg-card w-[300px] mx-auto rounded-lg">
      Last Updated: {lastUpdate}
      <Progress
        value={progress}
        className="w-[88%] h-[4px] p-0 m-0 rounded-none mx-auto items-center mt-1 bg-gray-500"
      />
    </div>
  );
};
