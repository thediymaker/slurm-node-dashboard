"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, LogOut, RefreshCw } from "lucide-react";

import { AdminKPICards } from "./admin-kpi-cards";
import ClusterStats from "./cluster-stats";
import AdminPlugins from "./plugins";
import { PartitionsPanel } from "./partitions-panel";
import { ReservationsPanel } from "./reservations-panel";
import { QoSPanel } from "./qos-panel";
import { SystemInfoPanel } from "./system-info-panel";
import { GPUAnalysisPanel } from "./gpu-analysis-panel";
import { HierarchyManager } from "@/components/admin/hierarchy/hierarchy-manager";
import { Organization, Account } from "@/actions/hierarchy";
import { gpuUtilizationPluginMetadata, jobMetricsPluginMetadata } from "@/actions/plugins";

interface AdminDashboardProps {
  initialOrgs?: Organization[];
  accounts?: Account[];
}

export default function AdminDashboard({ initialOrgs = [], accounts = [] }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signOut({ redirect: false });
      router.push("/login");
    } catch (err) {
      setError("Failed to sign out. Please try again.");
      setIsLoading(false);
    }
  }, [router]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "partitions", label: "Partitions" },
    { id: "reservations", label: "Reservations" },
    { id: "qos", label: "QoS" },
    ...(gpuUtilizationPluginMetadata.isEnabled && jobMetricsPluginMetadata.isEnabled ? [{ id: "gpu", label: "GPU Analysis" }] : []),
    { id: "plugins", label: "Plugins" },
    { id: "hierarchy", label: "Hierarchy" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6 max-w-[95%]">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Cluster management and system overview
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="outline" size="sm" className="h-9">
                <Home className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={isLoading}
              className="h-9"
            >
              {isLoading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isLoading ? "Signing out..." : "Sign Out"}
              </span>
            </Button>
          </div>
        </header>

        <Separator />

        {/* KPI Cards */}
        <AdminKPICards />

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-destructive hover:bg-transparent hover:underline"
              onClick={handleDismissError}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="space-y-6"
        >
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="data-[state=active]:bg-background"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <ClusterStats />
          </TabsContent>

          {/* Partitions Tab */}
          <TabsContent value="partitions" className="space-y-6 mt-6">
            <PartitionsPanel />
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations" className="space-y-6 mt-6">
            <ReservationsPanel />
          </TabsContent>

          {/* QoS Tab */}
          <TabsContent value="qos" className="space-y-6 mt-6">
            <QoSPanel />
          </TabsContent>

          {/* GPU Analysis Tab */}
          {gpuUtilizationPluginMetadata.isEnabled && jobMetricsPluginMetadata.isEnabled && (
            <TabsContent value="gpu" className="space-y-6 mt-6">
              <GPUAnalysisPanel />
            </TabsContent>
          )}

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="space-y-6 mt-6">
            <AdminPlugins />
          </TabsContent>

          {/* Hierarchy Tab */}
          <TabsContent value="hierarchy" className="space-y-6 mt-6">
            <HierarchyManager initialOrgs={initialOrgs} accounts={accounts} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <SystemInfoPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
