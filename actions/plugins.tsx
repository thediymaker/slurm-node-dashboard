// =============================================================================
// PLUGIN METADATA
// =============================================================================
// Central registry of all optional plugins/features in the dashboard.
// Each plugin has a name, description, and isEnabled flag based on env vars.

// -----------------------------------------------------------------------------
// PAGE PLUGINS
// -----------------------------------------------------------------------------

export const modulesPluginMetadata = {
  name: "Modules Plugin",
  description: "Software modules browser page.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_MODULES_PLUGIN === "true",
};

export const historyPluginMetadata = {
  name: "History Plugin",
  description: "Historical cluster state replay page.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN === "true",
};

export const jobMetricsPluginMetadata = {
  name: "Job Metrics Plugin",
  description: "Job metrics dashboard with historical analytics.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN === "true",
};

// -----------------------------------------------------------------------------
// INTEGRATION PLUGINS
// -----------------------------------------------------------------------------

export const openaiPluginMetadata = {
  name: "OpenAI Plugin",
  description: "AI chat assistant powered by OpenAI.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN === "true",
};

export const prometheusPluginMetadata = {
  name: "Prometheus Plugin",
  description: "Pulls metrics data from Prometheus.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN === "true",
};

export const influxDBPluginMetadata = {
  name: "InfluxDB Plugin",
  description: "Pulls metrics data from InfluxDB.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN === "true",
};

export const gpuUtilizationPluginMetadata = {
  name: "GPU Utilization Plugin",
  description: "GPU utilization metrics from Prometheus DCGM recording rules.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_GPU_UTILIZATION === "true",
};

// -----------------------------------------------------------------------------
// FEATURE FLAGS
// -----------------------------------------------------------------------------

export const maintenanceNotificationsMetadata = {
  name: "Maintenance Notifications",
  description: "Display maintenance notification banners.",
  isEnabled: process.env.NEXT_PUBLIC_MAINT_NOTIFICATIONS_ENABLED === "true",
};
