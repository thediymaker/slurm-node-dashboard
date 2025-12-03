import { getFlatHierarchy, getAccounts } from "@/actions/hierarchy";
import { HierarchyManager } from "@/components/admin/hierarchy/hierarchy-manager";
import BaseHeader from "@/components/base-header";

export default async function HierarchyPage() {
  const [orgs, accounts] = await Promise.all([
    getFlatHierarchy(),
    getAccounts()
  ]);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 bg-background min-h-screen">
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Organization Hierarchy</h2>
          <p className="text-muted-foreground">
            Manage departments, colleges, and group mappings.
          </p>
        </div>
        <BaseHeader />
      </div>
      
      <HierarchyManager initialOrgs={orgs} accounts={accounts} />
    </div>
  );
}
