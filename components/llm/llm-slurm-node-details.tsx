"use client";
import React from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Calendar,
  Clock,
  Server,
  Database,
  Activity,
  MonitorUp,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

const getStateColor = (state: string) => {
  const stateMap: Record<string, string> = {
    ALLOCATED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    IDLE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    DOWN: "bg-red-500/20 text-red-400 border-red-500/30",
    DRAINING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    MIXED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return stateMap[state] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
};

interface NodeInfo {
  name: string;
  cpus: number;
  cpu_load: number;
  state: string[];
  features: string[];
  partitions: string[];
  real_memory: number;
  architecture: string;
  boot_time: { number: number };
  last_busy: { number: number };
  gres_used: string;
  operating_system: string;
}

interface SlurmNodeDetailsProps {
  node: {
    nodes: NodeInfo[];
  };
}

export function SlurmNodeDetails({ node }: SlurmNodeDetailsProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  if (!node.nodes) {
    return (
      <div className="text-center p-4 text-red-400">
        Sorry, I couldn't find any node details for the node you provided.
        Please try again with a valid node name.
      </div>
    );
  }

  const nodeInfo = node.nodes[0];
  const cpuUsagePercentage = (nodeInfo.cpu_load / nodeInfo.cpus) * 100;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
    // Here you would typically call your refresh function
  };

  return (
    <Card className="w-full mx-auto bg-card border rounded-xl shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-semibold">
              Node:{" "}
              <span className="text-primary font-mono">{nodeInfo.name}</span>
            </CardTitle>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <RefreshCw
            className={`w-5 h-5 text-muted-foreground ${isRefreshing ? "animate-spin" : ""
              }`}
          />
        </motion.button>
      </div>

      <Separator />

      <CardContent className="p-4 grid gap-4">
        {/* CPU Usage Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-4 rounded-xl border bg-muted">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  System Load
                </span>
              </div>
              <span className="text-sm font-medium text-primary">
                {((parseFloat(cpuUsagePercentage.toFixed(1)) / 100).toFixed(1))}%
              </span>
            </div>
            <Progress value={cpuUsagePercentage} className="h-2" />
            <div className="mt-4 flex gap-2 flex-wrap">
              {nodeInfo.state.map((state, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={`${getStateColor(
                    state
                  )} transition-all duration-300`}
                >
                  {state}
                </Badge>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Features and Partitions Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-xl border bg-muted">
            <div className="text-sm font-medium text-muted-foreground">Features</div>
            <div className="flex flex-wrap gap-2">
              {nodeInfo.features.map((feature, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-muted text-muted-foreground border hover:bg-muted/80 transition-colors"
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl border bg-muted">
            <div className="text-sm font-medium text-muted-foreground">Partitions</div>
            <div className="flex flex-wrap gap-2">
              {nodeInfo.partitions.map((partition, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {partition}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* System Information Cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all group"
          >
            <Cpu className="w-4 h-4 text-primary group-hover:text-primary/80" />
            <div>
              <div className="text-sm text-muted-foreground">Memory</div>
              <div className="font-medium">
                {nodeInfo.real_memory.toLocaleString()} MB
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all group"
          >
            <Database className="w-4 h-4 text-primary group-hover:text-primary/80" />
            <div>
              <div className="text-sm text-muted-foreground">Architecture</div>
              <div className="font-medium">
                {nodeInfo.architecture}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Time Information */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-xl border bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <div className="text-sm text-muted-foreground">Boot Time</div>
            </div>
            <div className="font-medium">
              {new Date(nodeInfo.boot_time.number * 1000).toLocaleString()}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl border bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <div className="text-sm text-muted-foreground">Last Busy</div>
            </div>
            <div className="font-medium">
              {new Date(nodeInfo.last_busy.number * 1000).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid sm:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 border bg-muted rounded-xl transition-all"
          >
            <div className="text-sm text-muted-foreground">Operating System</div>
            <div className="font-medium">
              {nodeInfo.operating_system}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 border bg-muted rounded-xl transition-all"
          >
            <div className="text-sm text-muted-foreground">GRES Used</div>
            <div className="font-medium">
              {nodeInfo.gres_used || "None"}
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SlurmNodeDetails;
