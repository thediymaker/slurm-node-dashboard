import Footer from "@/components/footer/footer";
import Nodes from "@/components/nodeCard/nodes";
import { env } from "process";

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
