import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/dashboard";
import { getFlatHierarchy, getAccounts } from "@/actions/hierarchy";

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const [orgs, accounts] = await Promise.all([
    getFlatHierarchy(),
    getAccounts()
  ]);

  return <AdminDashboard initialOrgs={orgs} accounts={accounts} />;
}
