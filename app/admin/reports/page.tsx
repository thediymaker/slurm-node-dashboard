import { Metadata } from "next";
import AdminDashboard from "@/components/admin/dashboard";

export const metadata: Metadata = {
  title: "Admin Reports | Slurm Dashboard",
  description: "View system reports and metrics",
};

export default function AdminReportsPage() {
  return <AdminDashboard />;
}
