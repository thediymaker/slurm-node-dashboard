import Footer from "@/components/footer/footer";
import UnifiedHeader from "@/components/unified-header";
import { redirect } from "next/navigation";
import { getPublicConfig } from "@/lib/config";
import { isFeatureEnabled } from "@/lib/features";

import Modules from "@/components/modules/modules";

export default async function ModulesPage() {
  if (!(await isFeatureEnabled("modules"))) {
    redirect("/");
  }
  const { clusterName, clusterLogo } = getPublicConfig();

  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <UnifiedHeader
          title="Software Modules"
          description="Browse available software modules on the cluster."
        />
        <Modules />
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
