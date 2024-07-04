import Footer from "@/components/layout/footer";
import ChatIcon from "@/components/llm/chat-icon";
import MiniNodes from "@/components/miniCard/nodes";
import { env } from "process";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <MiniNodes />
        <ChatIcon />
        <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
