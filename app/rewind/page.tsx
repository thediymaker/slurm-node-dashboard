import Footer from "@/components/footer/footer";
import Rewind from "@/components/rewind/rewind";
import UnifiedHeader from "@/components/unified-header";
import { env } from "process";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-8 pt-6 ml-2 mx-auto">
        <UnifiedHeader 
          title="Cluster Rewind" 
          description="Replay historical cluster state and utilization." 
        />
        <Rewind />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
