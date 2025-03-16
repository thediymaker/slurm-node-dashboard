"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Home,
  LogOut,
  BarChart,
  Settings,
  ServerCrash,
  Shield,
  Activity,
} from "lucide-react";

import ClusterStats from "./cluster-stats";
import AdminPlugins from "./plugins";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="container mx-auto py-6 space-y-8 max-w-7xl">
      {/* Header section with title and actions */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your cluster and view system statistics
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

      {/* Main dashboard content with tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center">
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="plugins" className="flex items-center">
              <Shield className="mr-2 h-4 w-4" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Error message display */}
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

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-medium">
                Cluster Overview
              </CardTitle>
              <CardDescription>
                Cluster resource and status information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClusterStats />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plugins Tab Content */}
        <TabsContent value="plugins" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-medium">
                Plugins Management
              </CardTitle>
              <CardDescription>
                View status of available plugins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminPlugins />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab Content */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-medium">
                System Settings
              </CardTitle>
              <CardDescription>
                Configure your cluster environment and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-4">
                Settings configuration interface will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
