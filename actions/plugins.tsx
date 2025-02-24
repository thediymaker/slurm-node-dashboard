export const openaiPluginMetadata = {
  name: "OpenAI Plugin",
  description: "Displays the OpenAI chat.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN === "true",
};

export const PrometheusPluginMetadata = {
  name: "Prometheus Plugin",
  description: "Pulls data from Prometheus.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN === "true",
};

export const InfluxDBPluginMetadata = {
  name: "InfluxDB Plugin",
  description: "Pulls data from InfluxDB.",
  isEnabled: process.env.NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN === "true",
};
