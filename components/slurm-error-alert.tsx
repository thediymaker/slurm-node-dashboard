import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SlurmErrorAlertProps {
  error: Error | string;
  className?: string;
}

export function SlurmErrorAlert({ error, className }: SlurmErrorAlertProps) {
  const errorMessage = typeof error === "string" ? error : error.message;
  const isConnectionError = 
    errorMessage.includes("Unable to contact Slurm controller") ||
    errorMessage.includes("service may be down") ||
    errorMessage.includes("unreachable") ||
    errorMessage.includes("Network response was not ok") ||
    errorMessage.includes("fetch failed");

  const displayMessage = isConnectionError
    ? "Unable to contact Slurm controller"
    : errorMessage || "An error occurred";

  const subMessage = isConnectionError
    ? "The Slurm controller may be down or unreachable."
    : null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{displayMessage}</span>
          {subMessage && (
            <span className="text-xs opacity-90">{subMessage}</span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface SlurmCardErrorProps {
  error: Error | string;
  title?: string;
}

export function SlurmCardError({ error, title }: SlurmCardErrorProps) {
  const errorMessage = typeof error === "string" ? error : error.message;
  const isConnectionError = 
    errorMessage.includes("Unable to contact Slurm controller") ||
    errorMessage.includes("service may be down") ||
    errorMessage.includes("unreachable");

  const displayMessage = isConnectionError
    ? "Unable to contact Slurm controller"
    : title || "Failed to load data";

  const subMessage = isConnectionError
    ? "The Slurm controller may be down or unreachable."
    : null;

  return (
    <div className="flex items-start gap-2 text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{displayMessage}</span>
        {subMessage && (
          <span className="text-xs text-muted-foreground mt-1">{subMessage}</span>
        )}
      </div>
    </div>
  );
}
