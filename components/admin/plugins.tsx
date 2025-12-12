import { CheckCircle, XCircle } from "lucide-react";
import { AlertTitle, AlertDescription, Alert } from "../ui/alert";
import {
  Card,
  CardContent,
  CardFooter,
} from "../ui/card";
import {
  openaiPluginMetadata,
  prometheusPluginMetadata,
  influxDBPluginMetadata,
  modulesPluginMetadata,
  historyPluginMetadata,
  jobMetricsPluginMetadata,
  maintenanceNotificationsMetadata,
} from "@/actions/plugins";

interface PluginStatusProps {
  name: string;
  isEnabled: boolean;
}

const PluginStatus = ({ name, isEnabled }: PluginStatusProps) => {
  if (isEnabled) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>{name} Enabled</AlertTitle>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertTitle>{name} Disabled</AlertTitle>
      <AlertDescription>
        This plugin is not enabled. Check your environment configuration.
      </AlertDescription>
    </Alert>
  );
};

const AdminPlugins = ({ error }: any) => {
  return (
    <Card>
      <CardContent className="mt-6">
        <div className="space-y-4">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Page Plugins
          </div>
          <PluginStatus name="Modules" isEnabled={modulesPluginMetadata.isEnabled} />
          <PluginStatus name="History/Rewind" isEnabled={historyPluginMetadata.isEnabled} />
          <PluginStatus name="Job Metrics" isEnabled={jobMetricsPluginMetadata.isEnabled} />

          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2 pt-4">
            Integration Plugins
          </div>
          <PluginStatus name="OpenAI Chat" isEnabled={openaiPluginMetadata.isEnabled} />
          <PluginStatus name="Prometheus" isEnabled={prometheusPluginMetadata.isEnabled} />
          <PluginStatus name="InfluxDB" isEnabled={influxDBPluginMetadata.isEnabled} />

          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2 pt-4">
            Feature Flags
          </div>
          <PluginStatus name="Maintenance Notifications" isEnabled={maintenanceNotificationsMetadata.isEnabled} />
        </div>
      </CardContent>
      {error && (
        <CardFooter>
          <Alert variant="destructive" className="w-full">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardFooter>
      )}
    </Card>
  );
};

export default AdminPlugins;
