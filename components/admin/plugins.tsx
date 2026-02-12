"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  openaiPluginMetadata,
  prometheusPluginMetadata,
  influxDBPluginMetadata,
  gpuUtilizationPluginMetadata,
  modulesPluginMetadata,
  historyPluginMetadata,
  jobMetricsPluginMetadata,
  maintenanceNotificationsMetadata,
} from "@/actions/plugins";

interface PluginItemProps {
  name: string;
  description: string;
  isEnabled: boolean;
  envVar?: string;
}

const PluginItem = ({ name, description, isEnabled, envVar }: PluginItemProps) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border">
      <div>
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
        {envVar && (
          <code className="text-[10px] text-muted-foreground/70 font-mono mt-1 block">
            {envVar}
          </code>
        )}
      </div>
      <Badge variant={isEnabled ? "default" : "secondary"}>
        {isEnabled ? "Enabled" : "Disabled"}
      </Badge>
    </div>
  );
};

const AdminPlugins = () => {
  const pagePlugins = [modulesPluginMetadata, historyPluginMetadata, jobMetricsPluginMetadata];
  const integrationPlugins = [openaiPluginMetadata, prometheusPluginMetadata, gpuUtilizationPluginMetadata, influxDBPluginMetadata];
  const featureFlags = [maintenanceNotificationsMetadata];
  
  const totalEnabled = [...pagePlugins, ...integrationPlugins, ...featureFlags].filter(p => p.isEnabled).length;
  const totalPlugins = pagePlugins.length + integrationPlugins.length + featureFlags.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Plugins & Features</CardTitle>
          <CardDescription>
            {totalEnabled} of {totalPlugins} plugins enabled
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Page Plugins */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Page Plugins</CardTitle>
          <CardDescription>Additional pages and functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PluginItem
            name="Modules Browser"
            description="Browse and search available software modules"
            isEnabled={modulesPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_MODULES_PLUGIN"
          />
          <PluginItem
            name="History / Rewind"
            description="View and replay historical cluster state"
            isEnabled={historyPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN"
          />
          <PluginItem
            name="Job Metrics"
            description="Job statistics and analytics dashboard"
            isEnabled={jobMetricsPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN"
          />
        </CardContent>
      </Card>

      {/* Integration Plugins */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Integration Plugins</CardTitle>
          <CardDescription>External service connections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PluginItem
            name="OpenAI Chat"
            description="AI-powered assistant for cluster queries"
            isEnabled={openaiPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN"
          />
          <PluginItem
            name="Prometheus"
            description="Metrics collection and monitoring"
            isEnabled={prometheusPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN"
          />
          <PluginItem
            name="GPU Utilization"
            description="GPU metrics from Prometheus DCGM recording rules"
            isEnabled={gpuUtilizationPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_GPU_UTILIZATION"
          />
          <PluginItem
            name="InfluxDB"
            description="Time-series data storage"
            isEnabled={influxDBPluginMetadata.isEnabled}
            envVar="NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN"
          />
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Feature Flags</CardTitle>
          <CardDescription>Toggle individual features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PluginItem
            name="Maintenance Notifications"
            description="Show maintenance reservation alerts and banners"
            isEnabled={maintenanceNotificationsMetadata.isEnabled}
            envVar="NEXT_PUBLIC_MAINT_NOTIFICATIONS_ENABLED"
          />
        </CardContent>
      </Card>

      {/* Configuration Help */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Plugins are configured via environment variables. Set the variable to{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">&quot;true&quot;</code>{" "}
            to enable.
          </p>
          <div className="bg-muted p-3 rounded-md">
            <pre className="text-xs font-mono text-muted-foreground">
{`NEXT_PUBLIC_ENABLE_MODULES_PLUGIN=true
NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN=true
NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=true
NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN=true`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlugins;
