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

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
    // Here you would typically call your refresh function
  };

  return (
    <Card className="w-full mx-auto bg-card border-black border-2 rounded-xl shadow-xl relative overflow-hidden backdrop-blur-sm">
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          <div>
            <CardTitle className="text-3xl text-gray-200 p-1 m-1">
              Node:{" "}
              <span className="text-blue-400 font-medium">{nodeInfo.name}</span>
            </CardTitle>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          className="p-2 hover:bg-gray-800/50 rounded-full transition-colors"
        >
          <RefreshCw
            className={`w-5 h-5 text-gray-400 ${
              isRefreshing ? "animate-spin" : ""
            }`}
          />
        </motion.button>
      </div>

      <Separator className="bg-black" />

      <CardContent className="p-4 grid gap-4">
        {/* CPU Usage Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-4 rounded-xl border-2 bg-black/30">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-300">
                  System Load
                </span>
              </div>
              <span className="text-sm font-medium text-blue-400">
                {cpuUsagePercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={cpuUsagePercentage} className="h-2 bg-gray-800" />
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
          <div className="space-y-2 p-4 rounded-xl border-2 bg-black/30">
            <div className="text-sm font-medium text-gray-400">Features</div>
            <div className="flex flex-wrap gap-2">
              {nodeInfo.features.map((feature, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-700/50 transition-colors"
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl border-2 bg-black/30">
            <div className="text-sm font-medium text-gray-400">Partitions</div>
            <div className="flex flex-wrap gap-2">
              {nodeInfo.partitions.map((partition, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20 transition-colors"
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
            className="flex items-center gap-3 p-4 rounded-xl border-2 bg-black/30 transition-all group"
          >
            <Cpu className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
            <div>
              <div className="text-sm text-gray-500">Memory</div>
              <div className="font-medium text-gray-200">
                {nodeInfo.real_memory.toLocaleString()} MB
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-4 rounded-xl border-2 bg-black/30 transition-all group"
          >
            <Database className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
            <div>
              <div className="text-sm text-gray-500">Architecture</div>
              <div className="font-medium text-gray-200">
                {nodeInfo.architecture}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Time Information */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-xl border-2 bg-black/30">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">Boot Time</div>
            </div>
            <div className="font-medium text-gray-200">
              {new Date(nodeInfo.boot_time.number * 1000).toLocaleString()}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl border-2 bg-black/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">Last Busy</div>
            </div>
            <div className="font-medium text-gray-200">
              {new Date(nodeInfo.last_busy.number * 1000).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid sm:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 border-2 bg-black/30 rounded-xl transition-all"
          >
            <div className="text-sm text-gray-500">Operating System</div>
            <div className="font-medium text-gray-200">
              {nodeInfo.operating_system}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 border-2 bg-black/30 rounded-xl transition-all"
          >
            <div className="text-sm text-gray-500">GRES Used</div>
            <div className="font-medium text-gray-200">
              {nodeInfo.gres_used || "None"}
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SlurmNodeDetails;
