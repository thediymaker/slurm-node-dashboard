"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AdminKPICards } from "./admin-kpi-cards";
import ClusterStats from "./cluster-stats";
import AdminPlugins from "./plugins";
import type { DatabaseStatus, Features } from "@/lib/features";
import { PartitionsPanel } from "./partitions-panel";
import { ReservationsPanel } from "./reservations-panel";
import { QoSPanel } from "./qos-panel";
import { SystemInfoPanel } from "./system-info-panel";
import { GPUAnalysisPanel } from "./gpu-analysis-panel";
import { HierarchyManager } from "@/components/admin/hierarchy/hierarchy-manager";
import { LLMConfigPanel } from "./llm-config-panel";
import { Organization, Account } from "@/actions/hierarchy";
import { useFeature } from "@/components/runtime-config";

interface AdminDashboardProps {
  initialOrgs?: Organization[];
  accounts?: Account[];
  features: Features;
  database: DatabaseStatus;
}

export default function AdminDashboard({ initialOrgs = [], accounts = [], features, database }: AdminDashboardProps) {
  const gpuEnabled = useFeature("gpu");
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "partitions", label: "Partitions" },
    { id: "reservations", label: "Reservations" },
    { id: "qos", label: "QoS" },
    ...(gpuEnabled ? [{ id: "gpu", label: "GPU Analysis" }] : []),
    { id: "plugins", label: "Plugins" },
    { id: "hierarchy", label: "Hierarchy" },
    { id: "llm", label: "LLM Config" },
    { id: "settings", label: "Settings" },
  ];

  // Sits under the app header, in the same frame as the other pages; sign out
  // is in the header menu
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10">
      <div className="flex flex-col gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
          <div className="border-b">
            <TabsList className="flex h-auto w-full justify-start gap-5 overflow-x-auto overflow-y-hidden rounded-none bg-transparent p-0 [scrollbar-width:none]">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-normal text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {activeTab === "overview" && <AdminKPICards />}

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            <ClusterStats />
          </TabsContent>

          {/* Partitions Tab */}
          <TabsContent value="partitions" className="mt-0 space-y-6">
            <PartitionsPanel />
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations" className="mt-0 space-y-6">
            <ReservationsPanel />
          </TabsContent>

          {/* QoS Tab */}
          <TabsContent value="qos" className="mt-0 space-y-6">
            <QoSPanel />
          </TabsContent>

          {/* GPU Analysis Tab */}
          {gpuEnabled && (
            <TabsContent value="gpu" className="mt-0 space-y-6">
              <GPUAnalysisPanel />
            </TabsContent>
          )}

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="mt-0 space-y-6">
            <AdminPlugins features={features} database={database} />
          </TabsContent>

          {/* Hierarchy Tab */}
          <TabsContent value="hierarchy" className="mt-0 space-y-6">
            <HierarchyManager initialOrgs={initialOrgs} accounts={accounts} />
          </TabsContent>

          {/* LLM Config Tab */}
          <TabsContent value="llm" className="mt-0 space-y-6">
            <LLMConfigPanel />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-0 space-y-6">
            <SystemInfoPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
