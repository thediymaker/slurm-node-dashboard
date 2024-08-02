import Footer from "@/components/footer/footer";
import { env } from "process";

import Nodes from "@/components/nodeCard/nodes";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <Nodes />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
