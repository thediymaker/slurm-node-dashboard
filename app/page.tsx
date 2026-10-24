import Footer from "@/components/footer/footer";
import Nodes from "@/components/nodeCard/nodes";
import { getPublicConfig } from "@/lib/config";

export default async function Dashboard() {
  const { clusterName, clusterLogo } = getPublicConfig();

  return (
    <div className="mb-5">
      <div className="mx-auto max-w-[1600px] px-4 pb-2">
        <Nodes />
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
