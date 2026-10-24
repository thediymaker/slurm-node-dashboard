import { redirect } from "next/navigation";
import { getSession } from "@/auth";
import { getFlatHierarchy, getAccounts } from "@/actions/hierarchy";
import { HierarchyManager } from "@/components/admin/hierarchy/hierarchy-manager";

export const dynamic = 'force-dynamic';

export default async function HierarchyPage() {
  if (!(await getSession().catch(() => null))) redirect("/login");

  const [orgs, accounts] = await Promise.all([
    getFlatHierarchy(),
    getAccounts()
  ]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Organization hierarchy</h1>
        <p className="text-sm text-muted-foreground">Manage departments, colleges, and group mappings.</p>
      </div>
      
      <HierarchyManager initialOrgs={orgs} accounts={accounts} />
    </div>
  );
}
