import { cn } from "@/lib/utils";
import useSWR from "swr";

interface NodeUtilizationProps {
  nodeName: string;
  className?: string;
}

export default function NodeUtilization({
  nodeName,
  className,
}: NodeUtilizationProps) {
  const { data, error } = useSWR(
    `/api/prometheus/utilization?node=${nodeName}`,
    (url) => fetch(url).then((res) => res.json()),
    {
      refreshInterval: 300000,
    }
  );

  if (error || !data || data.status !== 200) {
    return (
      <div className={cn("flex items-center space-x-1.5", className)}>
        <span className="text-muted-foreground">7d Avg Util:</span>
        <span className="text-muted">N/A</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-1.5", className)}>
      <span className="text-muted-foreground">7d Avg Util:</span>
      <span className="font-medium">{data.score}%</span>
    </div>
  );
}
