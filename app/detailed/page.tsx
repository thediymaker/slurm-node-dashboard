import Nodes from "@/components/card/nodes";
import Footer from "@/components/layout/footer";
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
