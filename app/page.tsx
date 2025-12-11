import Footer from "@/components/footer/footer";

import Nodes from "@/components/nodeCard/nodes";

export default function Dashboard() {
  return (
    <div className="mb-5">
      <div className="p-2 ml-2 mx-auto">
        <Nodes />
        <Footer cluster={process.env.CLUSTER_NAME} logo={process.env.CLUSTER_LOGO} />
      </div>
    </div>
  );
}
