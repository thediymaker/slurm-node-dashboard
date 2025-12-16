import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  openaiPluginMetadata,
  prometheusPluginMetadata,
  influxDBPluginMetadata,
  modulesPluginMetadata,
  historyPluginMetadata,
  jobMetricsPluginMetadata,
  maintenanceNotificationsMetadata,
} from "@/actions/plugins";

interface PluginItemProps {
  name: string;
  description: string;
  isEnabled: boolean;
}

const PluginItem = ({ name, description, isEnabled }: PluginItemProps) => {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Badge variant={isEnabled ? "default" : "secondary"}>
        {isEnabled ? "Enabled" : "Disabled"}
      </Badge>
    </div>
  );
};

const AdminPlugins = () => {
  return (
    <Card>
      <CardContent className="pt-6">
        {/* Page Plugins */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Page Plugins
          </h3>
          <div className="space-y-1">
            <PluginItem
              name="Modules"
              description="Display available software modules"
              isEnabled={modulesPluginMetadata.isEnabled}
            />
            <Separator />
            <PluginItem
              name="History / Rewind"
              description="View historical node data"
              isEnabled={historyPluginMetadata.isEnabled}
            />
            <Separator />
            <PluginItem
              name="Job Metrics"
              description="Job statistics and analytics dashboard"
              isEnabled={jobMetricsPluginMetadata.isEnabled}
            />
          </div>
        </div>

        {/* Integration Plugins */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Integration Plugins
          </h3>
          <div className="space-y-1">
            <PluginItem
              name="OpenAI Chat"
              description="AI-powered assistant for cluster queries"
              isEnabled={openaiPluginMetadata.isEnabled}
            />
            <Separator />
            <PluginItem
              name="Prometheus"
              description="Metrics collection and monitoring"
              isEnabled={prometheusPluginMetadata.isEnabled}
            />
            <Separator />
            <PluginItem
              name="InfluxDB"
              description="Time-series data storage"
              isEnabled={influxDBPluginMetadata.isEnabled}
            />
          </div>
        </div>

        {/* Feature Flags */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Feature Flags
          </h3>
          <div className="space-y-1">
            <PluginItem
              name="Maintenance Notifications"
              description="Show maintenance reservation alerts"
              isEnabled={maintenanceNotificationsMetadata.isEnabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPlugins;
