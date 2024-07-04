import ChatIcon from "@/components/llm/chat-icon";
import Footer from "@/components/layout/footer";
import { env } from "process";
import BasicNodes from "@/components/basicCard/nodes";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <BasicNodes />
        <ChatIcon />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
