import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { AlertTitle, AlertDescription, Alert } from "../ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  openaiPluginMetadata,
  PrometheusPluginMetadata,
  InfluxDBPluginMetadata,
} from "@/actions/plugins";

const AdminPlugins = ({ isLoading, error, handleGenerateEmbeddings }: any) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plugins Management</CardTitle>
        <CardDescription>Manage and update plugin settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {openaiPluginMetadata.isEnabled ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>OpenAI Plugin Enabled</AlertTitle>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>OpenAI Plugin Disabled</AlertTitle>
              <AlertDescription>
                The OpenAI Plugin is currently not enabled. Please check your
                configuration.
              </AlertDescription>
            </Alert>
          )}

          {PrometheusPluginMetadata.isEnabled ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Prometheus Plugin Enabled</AlertTitle>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Prometheus Plugin Disabled</AlertTitle>
              <AlertDescription>
                The Prometheus Plugin is currently not enabled. Please check
                your configuration.
              </AlertDescription>
            </Alert>
          )}

          {InfluxDBPluginMetadata.isEnabled ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>InfluxDB Plugin Enabled</AlertTitle>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>InfluxDB Plugin Disabled</AlertTitle>
              <AlertDescription>
                The InfluxDB Plugin is currently not enabled. Please check your
                configuration.
              </AlertDescription>
            </Alert>
          )}
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
