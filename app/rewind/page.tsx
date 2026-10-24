import Footer from "@/components/footer/footer";
import Rewind from "@/components/rewind/rewind";
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
      <div className="mx-auto max-w-[1600px] px-4 pb-2">
        <Rewind />
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
