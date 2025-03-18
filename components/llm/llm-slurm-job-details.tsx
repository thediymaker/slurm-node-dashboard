"use client";
import React, { useState } from "react";
import { CardTitle, CardContent, Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { convertUnixToHumanReadable } from "@/utils/nodes";
import {
  Clock,
  User,
  Server,
  HardDrive,
  Terminal,
  RefreshCw,
  Cpu,
  FolderOutput,
  Group,
  Timer,
} from "lucide-react";

interface JobResourcesNode {
  nodename: string;
}

interface JobInfo {
  job_id: string;
  name: string;
  nodes: string;
  command: string;
  job_state: string[];
  start_time: { number: number };
  end_time: { number: number };
  cpus_per_task: { number: number };
  memory_per_node: { number: number };
  gres_detail: string[];
  standard_output: string;
  user_name: string;
  group_name: string;
  partition: string;
  job_resources: {
    allocated_cores: number;
    allocated_nodes: JobResourcesNode[];
  };
  standard_error: string;
  standard_input: string;
  time_limit: { number: number };
}

interface SlurmJobDetailsProps {
  job: {
    jobs: JobInfo[];
  };
}

export function SlurmJobDetails({ job }: SlurmJobDetailsProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  if (!job.jobs.length) {
    return (
      <div className="text-center p-4 text-red-400">
        Sorry, I couldn't find any job details for the job ID you provided.
        Please try again with a valid job ID.
      </div>
    );
  }

  const jobInfo = job.jobs[0];

  const getStateColor = (state: string) => {
    const stateMap: Record<string, string> = {
      RUNNING: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      COMPLETED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
      CANCELLED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return stateMap[state] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
    // Here you would typically call your refresh function
  };

  const cpuProgress =
    (jobInfo.job_resources?.allocated_cores / jobInfo.cpus_per_task.number) *
    100;

  return (
    <Card className="w-full mx-auto bg-card border-black border-2 rounded-xl shadow-xl relative overflow-hidden backdrop-blur-sm">
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          <div>
            <CardTitle className="text-3xl text-gray-200 p-1 m-1">
              Job:{" "}
              <span className="text-blue-400 font-medium">
                {jobInfo.job_id}
              </span>
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
        {/* Job Status Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-4 rounded-xl border-2 bg-black/30">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-300">
                  CPU Allocation
                </span>
              </div>
              <span className="text-sm font-medium text-blue-400">
                {jobInfo.job_resources?.allocated_cores || 0} cores
              </span>
            </div>
            <Progress value={cpuProgress} className="h-2 bg-gray-800" />
            <div className="mt-4 flex gap-2 flex-wrap">
              {jobInfo.job_state.map((state, index) => (
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

        {/* Job Information Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-4 rounded-xl border-2 bg-black/30 transition-all group"
          >
            <Terminal className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
            <div>
              <div className="text-sm text-gray-500">Command</div>
              <div className="font-medium text-gray-200 truncate max-w-xs">
                {jobInfo.command}
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-4 rounded-xl border-2 bg-black/30 transition-all group"
          >
            <HardDrive className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
            <div>
              <div className="text-sm text-gray-500">Memory per Node</div>
              <div className="font-medium text-gray-200">
                {jobInfo.memory_per_node?.number
                  ? `${(jobInfo.memory_per_node.number / 1024).toFixed(2)} GB`
                  : "N/A"}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Time Information */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-xl border-2 bg-black/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">Start Time</div>
            </div>
            <div className="font-medium text-gray-200">
              {jobInfo.start_time?.number
                ? convertUnixToHumanReadable(jobInfo.start_time.number)
                : "N/A"}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl border-2 bg-black/30">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">Time Limit</div>
            </div>
            <div className="font-medium text-gray-200">
              {jobInfo.time_limit?.number
                ? `${jobInfo.time_limit.number} minutes`
                : "N/A"}
            </div>
          </div>
        </div>

        {/* User Information */}
        <div className="grid sm:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-xl border-2 bg-black/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">User</div>
            </div>
            <div className="font-medium text-gray-200 mt-1">
              {jobInfo.user_name}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-xl border-2 bg-black/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <Group className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">Group</div>
            </div>
            <div className="font-medium text-gray-200 mt-1">
              {jobInfo.group_name}
            </div>
          </motion.div>
        </div>

        {/* File Paths */}
        <div className="space-y-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-xl border-2 bg-black/30 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <FolderOutput className="w-4 h-4 text-blue-400" />
              <div className="text-sm text-gray-500">Output Paths</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-gray-400">Standard Output</div>
              <div className="font-medium text-gray-200 text-sm break-all">
                {jobInfo.standard_output}
              </div>
              <div className="text-xs text-gray-400 mt-2">Standard Error</div>
              <div className="font-medium text-gray-200 text-sm break-all">
                {jobInfo.standard_error}
              </div>
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SlurmJobDetails;
