import Footer from "@/components/footer/footer";
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
      <div className="mx-auto max-w-[1600px] px-4 pb-2">
        <Modules />
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
