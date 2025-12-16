"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, LogOut } from "lucide-react";

import { AdminKPICards } from "./admin-kpi-cards";
import ClusterStats from "./cluster-stats";
import AdminPlugins from "./plugins";
import { PartitionsPanel } from "./partitions-panel";
import { ReservationsPanel } from "./reservations-panel";
import { QoSPanel } from "./qos-panel";
import { SystemInfoPanel } from "./system-info-panel";
import { HierarchyManager } from "@/components/admin/hierarchy/hierarchy-manager";
import { Organization, Account } from "@/actions/hierarchy";

interface AdminDashboardProps {
  initialOrgs?: Organization[];
  accounts?: Account[];
}

export default function AdminDashboard({ initialOrgs = [], accounts = [] }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({ redirect: false });
      router.push("/login");
    } catch (err) {
      setError("Failed to sign out. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-[95%]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Cluster management and system overview
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href="/">
            <Button variant="outline" size="sm" className="h-9">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isLoading}
            className="h-9"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoading ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* KPI Cards */}
      <AdminKPICards />

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-auto p-0 text-destructive hover:bg-transparent hover:underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="partitions">Partitions</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="qos">QoS</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <ClusterStats />
        </TabsContent>

        {/* Partitions Tab */}
        <TabsContent value="partitions" className="space-y-6">
          <PartitionsPanel />
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="space-y-6">
          <ReservationsPanel />
        </TabsContent>

        {/* QoS Tab */}
        <TabsContent value="qos" className="space-y-6">
          <QoSPanel />
        </TabsContent>

        {/* Plugins Tab */}
        <TabsContent value="plugins" className="space-y-6">
          <AdminPlugins />
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-6">
          <HierarchyManager initialOrgs={initialOrgs} accounts={accounts} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <SystemInfoPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
