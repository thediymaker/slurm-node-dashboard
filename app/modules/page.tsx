import Footer from "@/components/footer/footer";
import { env } from "process";
import UnifiedHeader from "@/components/unified-header";

import Modules from "@/components/modules/modules";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-8 pt-6 ml-2 mx-auto">
        <UnifiedHeader 
          title="Software Modules" 
          description="Browse available software modules on the cluster." 
        />
        <Modules />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
