import { cn } from "@/lib/utils";
import useSWR from "swr";
import { Loader2 } from "lucide-react";

interface NodeUtilizationProps {
  nodeName: string;
  className?: string;
}

export default function NodeUtilization({
  nodeName,
  className,
}: NodeUtilizationProps) {
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "";
  const { data, error, isLoading } = useSWR(
    `${baseURL}/api/prometheus/utilization?node=${nodeName}`,
    (url) => fetch(url).then((res) => res.json()),
    {
      refreshInterval: 300000,
    }
  );

  return (
    <div className={cn("flex items-center space-x-1.5", className)}>
      <span className="text-muted-foreground">24h CPU Util:</span>
      {isLoading ? (
        <div className="flex items-center space-x-1">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      ) : error || !data || data.status !== 200 ? (
        <span className="text-muted">N/A</span>
      ) : (
        <span className="font-medium">{data.score}%</span>
      )}
    </div>
  );
}
