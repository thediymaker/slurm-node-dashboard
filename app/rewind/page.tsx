import Footer from "@/components/footer/footer";
import Rewind from "@/components/rewind/rewind";
import UnifiedHeader from "@/components/unified-header";
import { env } from "process";
import { redirect } from "next/navigation";

export default function RewindPage() {
  // Plugin Feature Flag Check
  if (process.env.NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN !== 'true') {
    redirect("/");
  }

  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
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
