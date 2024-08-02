import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Computer } from "lucide-react";
import { Separator } from "../ui/separator";

interface SlurmJobDetailsProps {
  node: any;
}

export function SlurmNodeDetails({ node }: SlurmJobDetailsProps) {
  if (!node.nodes)
    return (
      <div>
        Sorry, I couldn't find any node details for the node you provided.
        Please try again with a valid node name.
      </div>
    );
  const nodeInfo = node.nodes[0];

  console.log(nodeInfo);
  return (
    <Card className="w-full mx-auto">
      <div className="flex items-center gap-4 bg-muted/50 px-6 py-4 mx-auto">
        <div className="grid gap-1">
          <CardTitle className="font-extralight">
            Node: <span className="text-blue-500">{nodeInfo.name}</span>
          </CardTitle>
        </div>
      </div>
      <Separator className="bg-gray-500 w-[95%] mx-auto" />
      <CardContent className="p-6 grid gap-2">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Name</div>
            <div>{nodeInfo.name}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Cores</div>
            <div>{nodeInfo.cpus}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">CPU Load</div>
            <div>{(nodeInfo.cpu_load / nodeInfo.cpus).toFixed(2)}%</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">State</div>
            {nodeInfo.state.map((state: string, index: number) => (
              <div key={index} className="text-blue-500">
                {state}
              </div>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Features</div>
            <div className="flex items-start">
              {nodeInfo.features.map((feature: any, index: any) => (
                <div
                  className="p-1  border-2 border-gray-500 rounded-lg m-1 text-sm font-extralight w-fit h-fit"
                  key={index}
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Partitions</div>
            <div className="flex items-start">
              {nodeInfo.partitions.map((partition: any, index: any) => (
                <div
                  className="p-1 border-2 border-gray-500 rounded-lg m-1 text-sm font-extralight w-fit h-fit"
                  key={index}
                >
                  {partition}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Real Memory</div>
            <div>{nodeInfo.real_memory} MB</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Architecture</div>
            <div>{nodeInfo.architecture}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Boot Time</div>
            <div>
              {new Date(nodeInfo.boot_time.number * 1000).toLocaleString()}
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Last Busy</div>
            <div>
              {new Date(nodeInfo.last_busy.number * 1000).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Gres Used</div>
            <div>{nodeInfo.gres_used}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">
              Operating System
            </div>
            <div>{nodeInfo.operating_system}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
