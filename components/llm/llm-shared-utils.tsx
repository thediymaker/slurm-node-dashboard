"use client";
import React, { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

// ============ State Color Utilities ============

export const jobStateColors: Record<string, string> = {
  RUNNING: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  COMPLETED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
  CANCELLED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  TIMEOUT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  NODE_FAIL: "bg-red-500/20 text-red-400 border-red-500/30",
  PREEMPTED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  OUT_OF_MEMORY: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const nodeStateColors: Record<string, string> = {
  ALLOCATED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IDLE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  DOWN: "bg-red-500/20 text-red-400 border-red-500/30",
  DRAINING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DRAINED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MIXED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  COMPLETING: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  RESERVED: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

export const getStateColor = (state: string, type: 'job' | 'node' = 'job') => {
  const colorMap = type === 'job' ? jobStateColors : nodeStateColors;
  return colorMap[state] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
};

// ============ Time Formatting Utilities ============

export const formatRelativeTime = (unixTimestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - unixTimestamp;
  
  if (diff < 0) {
    // Future time
    const absDiff = Math.abs(diff);
    if (absDiff < 60) return `in ${Math.floor(absDiff)}s`;
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)}m`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)}h`;
    return `in ${Math.floor(absDiff / 86400)}d`;
  }
  
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
};

export const formatMemory = (mb: number): string => {
  if (mb < 1024) return `${mb} MB`;
  if (mb < 1024 * 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
};

// ============ Copy Button Component ============

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleCopy}
      className={`p-1.5 hover:bg-muted rounded-md transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
      )}
    </motion.button>
  );
}

// ============ State Badge Component ============

interface StateBadgeProps {
  state: string;
  type?: 'job' | 'node';
  animated?: boolean;
}

export function StateBadge({ state, type = 'job', animated = false }: StateBadgeProps) {
  const colorClass = getStateColor(state, type);
  const isActive = state === 'RUNNING' || state === 'ALLOCATED' || state === 'MIXED';
  
  return (
    <Badge
      variant="secondary"
      className={`${colorClass} transition-all duration-300 relative`}
    >
      {animated && isActive && (
        <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
      <span className={animated && isActive ? "ml-2" : ""}>{state}</span>
    </Badge>
  );
}

// ============ Info Row Component ============

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  copyable?: string;
  monospace?: boolean;
}

export function InfoRow({ icon, label, value, copyable, monospace = false }: InfoRowProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="flex items-center gap-3 p-4 rounded-xl border bg-muted transition-all group"
    >
      <div className="text-primary group-hover:text-primary/80">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`font-medium truncate ${monospace ? 'font-mono text-sm' : ''}`}>
          {value}
        </div>
      </div>
      {copyable && <CopyButton text={copyable} />}
    </motion.div>
  );
}

// ============ Empty State Component ============

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="text-center p-6 rounded-xl border border-dashed border-muted-foreground/30">
      {icon && <div className="mb-2 text-muted-foreground">{icon}</div>}
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// ============ Section Header Component ============

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}

export function SectionHeader({ icon, title, badge }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      {badge}
    </div>
  );
}

// ============ Metric Card Component ============

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricCard({ icon, label, value, subValue, trend }: MetricCardProps) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-muted-foreground',
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-xl border bg-muted transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="font-semibold text-lg">{value}</div>
      {subValue && (
        <div className={`text-xs mt-1 ${trend ? trendColors[trend] : 'text-muted-foreground'}`}>
          {subValue}
        </div>
      )}
    </motion.div>
  );
}
