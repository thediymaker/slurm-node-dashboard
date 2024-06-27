import Footer from "@/components/layout/footer";
import BasicNodes from "@/components/basicCard/nodes";
import { env } from "process";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <BasicNodes />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
