import Footer from "@/components/footer/footer";
import Rewind from "@/components/rewind/rewind";
import UnifiedHeader from "@/components/unified-header";
import { redirect } from "next/navigation";
import { getPublicConfig } from "@/lib/config";
import { isFeatureEnabled } from "@/lib/features";

export default async function RewindPage() {
  if (!(await isFeatureEnabled("rewind"))) {
    redirect("/");
  }
  const { clusterName, clusterLogo } = getPublicConfig();

  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <UnifiedHeader
          title="Cluster Rewind"
          description="Replay historical cluster state and utilization."
        />
        <Rewind />
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
