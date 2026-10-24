import { redirect } from "next/navigation";
import { getSession, isAdminLoginConfigured } from "@/auth";
import LoginForm from "@/components/login-form";

export default async function LoginPage() {
  if (await getSession().catch(() => null)) redirect("/admin");

  if (!isAdminLoginConfigured()) {
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col gap-2 rounded-xl border bg-card p-6">
        <h1 className="text-lg font-semibold">Admin sign-in isn&apos;t set up</h1>
        <p className="text-sm text-muted-foreground">
          Set <code className="font-mono">ADMIN_USERNAME</code>, <code className="font-mono">ADMIN_PASSWORD</code> and{" "}
          <code className="font-mono">BETTER_AUTH_SECRET</code>, then restart the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4">
      <LoginForm />
    </div>
  );
}
