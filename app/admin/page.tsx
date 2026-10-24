import { getSession } from "@/auth";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/dashboard";
import { getFlatHierarchy, getAccounts } from "@/actions/hierarchy";
import { getDatabaseStatus, getFeatures } from "@/lib/features";

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [orgs, accounts, features, database] = await Promise.all([
    getFlatHierarchy(),
    getAccounts(),
    getFeatures(),
    getDatabaseStatus(),
  ]);

  return <AdminDashboard initialOrgs={orgs} accounts={accounts} features={features} database={database} />;
}
