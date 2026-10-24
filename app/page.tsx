import Footer from "@/components/footer/footer";
import { cookies } from "next/headers";
import { getRandomGeekName } from "@/lib/utils";

import Nodes from "@/components/nodeCard/nodes";
import { getPublicConfig } from "@/lib/config";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const username = cookieStore.get("SSONAME")?.value || getRandomGeekName();
  const { clusterName, clusterLogo } = getPublicConfig();

  return (
    <div className="mb-5">
      <div className="px-2 pb-2">
        <Nodes username={username} />
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
