"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, LogOut, BarChart, Settings } from "lucide-react";
import ClusterStats from "./cluster-stats";
import AdminPlugins from "./plugins";
import JobMetricsDashboard from "./job-metrics-dashboard";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Extract the tab from the URL or default to "overview"
  const getDefaultTab = () => {
    if (pathname.includes("reports")) return "reports";
    return "overview";
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="space-y-6 mx-5 mt-5">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
      <Separator />
      <div className="max-w-[90%] mx-auto w-full">
        <div className="mb-4 mt-4">
          <AdminPlugins />
        </div>
        <div>
          <ClusterStats />
        </div>
      </div>
    </div>
  );
}
