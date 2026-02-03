import Footer from "@/components/footer/footer";
import { env } from "process";
import { cookies } from "next/headers";
import { getRandomGeekName } from "@/lib/utils";

import Nodes from "@/components/nodeCard/nodes";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const username = cookieStore.get("SSONAME")?.value || getRandomGeekName();

  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <Nodes username={username} />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
