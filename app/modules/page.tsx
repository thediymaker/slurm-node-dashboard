import Footer from "@/components/layout/footer";
import { env } from "process";

import Modules from "@/components/modules/modules";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <Modules />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
