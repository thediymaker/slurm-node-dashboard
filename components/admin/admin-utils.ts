// =============================================================================
// ADMIN UTILITIES
// =============================================================================
// Shared utilities, configurations, and types for admin components

import useSWR, { SWRConfiguration } from "swr";
import { useState } from "react";

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface SlurmValue {
    set?: boolean;
    infinite?: boolean;
    number?: number;
}

export interface AdminNode {
    name: string;
    state?: string[];
    cpus?: number;
    alloc_cpus?: number;
    real_memory?: number;
    alloc_memory?: number;
    partitions?: string[];
    features?: string[];
    gres?: string;
    gres_used?: string;
    reason?: string;
}

export interface AdminNodesResponse {
    nodes: AdminNode[];
}

export interface AdminPartitionSummary {
    name: string;
    state?: string[];
    partition?: {
        state?: string[];
        default?: boolean;
    };
    nodes?: {
        total?: number;
        allowed?: string;
    };
    cpus?: {
        total?: number;
    };
    maximums?: {
        time?: SlurmValue;
    };
    priority?: {
        job_factor?: number;
    };
}

export interface AdminPartitionsResponse {
    partitions: AdminPartitionSummary[];
}

export interface AdminDiagResponse {
    statistics?: {
        jobs_running?: number;
        jobs_pending?: number;
        jobs_submitted?: number;
        jobs_started?: number;
        jobs_completed?: number;
        jobs_canceled?: number;
        jobs_failed?: number;
        server_thread_count?: number;
        agent_count?: number;
        agent_queue_size?: number;
        dbd_agent_queue_size?: number;
        schedule_cycle_max?: number;
        schedule_cycle_mean?: number;
        schedule_cycle_last?: number;
        bf_active?: boolean;
        bf_cycle_counter?: number;
        server_start_time?: { number?: number; set?: boolean };
    };
    meta?: {
        slurm?: {
            version?: {
                major?: string;
                minor?: string;
                micro?: string;
            };
            release?: string;
            cluster?: string;
        };
    };
}

export interface AdminJobsResponse {
    jobs: Array<{
        job_id?: number;
        name?: string;
        user_name?: string;
        state?: { current?: string[] };
        partition?: string;
        nodes?: string;
    }>;
}

export interface AdminReservation {
    name: string;
    start_time?: { number?: number };
    end_time?: { number?: number };
    node_count?: number;
    node_list?: string;
    users?: string;
    accounts?: string;
    flags?: string[];
    features?: string;
    partition?: string;
}

export interface AdminReservationsResponse {
    reservations: AdminReservation[];
}

export interface AdminQoS {
    name: string;
    description?: string;
    priority?: SlurmValue;
    limits?: {
        max?: {
            jobs?: { per?: { user?: SlurmValue; account?: SlurmValue } };
            wall_clock?: { per?: { qos?: SlurmValue; job?: SlurmValue } };
            tres?: { per?: { user?: any[]; job?: any[]; node?: any[] } };
            accruing?: { per?: { account?: SlurmValue } };
        };
        min?: {
            tres?: { per?: { job?: any[] } };
        };
        factor?: number;
    };
    preempt?: { mode?: string[]; list?: string[] };
    usage_factor?: SlurmValue;
    flags?: string[];
}

export interface AdminQoSResponse {
    qos: AdminQoS[];
}

export interface AdminClusterTres {
    type: string;
    count: number;
    name: string;
}

export interface AdminClusterResponse {
    clusters: Array<{
        name?: string;
        tres?: AdminClusterTres[];
    }>;
}

// -----------------------------------------------------------------------------
// API Fetcher
// -----------------------------------------------------------------------------

export const adminFetcher = async (url: string) => {
    try {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json" },
            cache: 'no-store', // Prevent caching to always get fresh data
        });
        if (!res.ok) {
            // Try to get error message from response
            let errorMessage = "Failed to fetch data";
            try {
                const errorData = await res.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch {
                // If we can't parse the error, use status text
                errorMessage = res.statusText || errorMessage;
            }
            
            const error = new Error(errorMessage);
            (error as any).status = res.status;
            throw error;
        }
        return res.json();
    } catch (err) {
        // Handle network errors (ECONNREFUSED, fetch failed, etc.)
        if (err instanceof Error) {
            if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
                const error = new Error('Unable to contact Slurm controller. The service may be down or unreachable.');
                (error as any).status = 503;
                throw error;
            }
            throw err;
        }
        throw new Error('Network error occurred');
    }
};

// -----------------------------------------------------------------------------
// SWR Configuration
// -----------------------------------------------------------------------------

export const DEFAULT_REFRESH_INTERVAL = 15000; // 15 seconds
export const SLOW_REFRESH_INTERVAL = 60000; // 1 minute

export const defaultSWRConfig: SWRConfiguration = {
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
    errorRetryCount: 3,
};

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

export const API_ENDPOINTS = {
    DIAG: "/api/slurm/diag",
    NODES: "/api/slurm/nodes",
    PARTITIONS: "/api/slurm/partitions",
    JOBS: "/api/slurm/jobs",
    RESERVATIONS: "/api/slurm/reservations",
    QOS: "/api/slurm/qos",
    CLUSTER: "/api/slurm/cluster",
} as const;

// -----------------------------------------------------------------------------
// Custom Hooks for Admin Data with Error Tracking
// -----------------------------------------------------------------------------

// Helper hook that wraps SWR with proper error tracking during revalidation
function useAdminSWR<T>(key: string) {
    const [lastError, setLastError] = useState<Error | null>(null);
    
    const result = useSWR<T>(key, adminFetcher, {
        ...defaultSWRConfig,
        onSuccess: () => {
            setLastError(null);
        },
        onError: (err) => {
            setLastError(err);
        },
    });
    
    // Combine SWR error with tracked error for revalidation failures
    const hasConnectionError = !!(result.error || (lastError && result.data));
    
    return {
        ...result,
        // Override error to include revalidation errors
        error: result.error || (lastError && result.data ? lastError : null),
        hasConnectionError,
        lastError,
    };
}

export function useAdminDiag() {
    return useAdminSWR<AdminDiagResponse>(API_ENDPOINTS.DIAG);
}

export function useAdminNodes() {
    return useAdminSWR<AdminNodesResponse>(API_ENDPOINTS.NODES);
}

export function useAdminPartitions() {
    return useAdminSWR<AdminPartitionsResponse>(API_ENDPOINTS.PARTITIONS);
}

export function useAdminJobs() {
    return useAdminSWR<AdminJobsResponse>(API_ENDPOINTS.JOBS);
}

export function useAdminReservations() {
    return useAdminSWR<AdminReservationsResponse>(API_ENDPOINTS.RESERVATIONS);
}

export function useAdminQoS() {
    return useAdminSWR<AdminQoSResponse>(API_ENDPOINTS.QOS);
}

export function useAdminCluster() {
    return useAdminSWR<AdminClusterResponse>(API_ENDPOINTS.CLUSTER);
}

// -----------------------------------------------------------------------------
// Slurm Value Helpers
// -----------------------------------------------------------------------------

/**
 * Extract a displayable value from Slurm's {set, infinite, number} format
 */
export function extractSlurmValue(val: SlurmValue | number | undefined): string {
    if (val === undefined || val === null) return "—";
    if (typeof val === "number") return val.toLocaleString();
    if (val.infinite) return "Unlimited";
    if (val.number !== undefined && val.number >= 0) return val.number.toLocaleString();
    return "—";
}

/**
 * Get the raw number from a Slurm value, or undefined if not set
 */
export function getSlurmNumber(val: SlurmValue | number | undefined): number | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === "number") return val;
    if (val.infinite) return Infinity;
    if (val.number !== undefined && val.number >= 0) return val.number;
    return undefined;
}

// -----------------------------------------------------------------------------
// Time Formatting
// -----------------------------------------------------------------------------

/**
 * Format seconds into a human-readable duration string
 */
export function formatDuration(seconds?: number, options?: { infinite?: boolean; showSeconds?: boolean }): string {
    if (options?.infinite) return "Unlimited";
    if (!seconds || seconds <= 0) return "—";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    if (options?.showSeconds) return `${secs}s`;
    return "< 1m";
}

/**
 * Format a Unix timestamp to a localized string
 */
export function formatTimestamp(unixSeconds?: number, options?: Intl.DateTimeFormatOptions): string {
    if (!unixSeconds || unixSeconds <= 0) return "—";
    const defaultOptions: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    };
    return new Date(unixSeconds * 1000).toLocaleString(undefined, options || defaultOptions);
}

/**
 * Calculate remaining time from a future Unix timestamp
 */
export function getTimeRemaining(endTimeSeconds?: number): { text: string; isExpired: boolean; urgency: "normal" | "warning" | "critical" } {
    if (!endTimeSeconds) return { text: "—", isExpired: false, urgency: "normal" };
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTimeSeconds - now;

    if (remaining <= 0) return { text: "Expired", isExpired: true, urgency: "critical" };

    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);

    let urgency: "normal" | "warning" | "critical" = "normal";
    if (remaining < 3600) urgency = "critical"; // Less than 1 hour
    else if (remaining < 86400) urgency = "warning"; // Less than 1 day

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return { text: `${days}d ${hours % 24}h`, isExpired: false, urgency };
    }
    if (hours > 0) return { text: `${hours}h ${mins}m`, isExpired: false, urgency };
    return { text: `${mins}m`, isExpired: false, urgency };
}

// -----------------------------------------------------------------------------
// Node State Helpers
// -----------------------------------------------------------------------------

export type NodeState = "IDLE" | "ALLOCATED" | "MIXED" | "DOWN" | "DRAIN" | "DRAINING" | "RESERVED" | "UNKNOWN";

export interface NodeStateFlags {
    isDown: boolean;
    isDraining: boolean;
    isDrained: boolean;
    isReserved: boolean;
    isMaintenance: boolean;
    isAllocated: boolean;
    isMixed: boolean;
    isIdle: boolean;
}

/**
 * Parse node state array into individual flags
 */
export function parseNodeState(state?: string[]): NodeStateFlags {
    const stateSet = new Set((state || []).map(s => s?.toUpperCase()));
    
    return {
        isDown: stateSet.has("DOWN"),
        isDraining: stateSet.has("DRAINING"),
        isDrained: stateSet.has("DRAIN") || stateSet.has("DRAINED"),
        isReserved: stateSet.has("RESERVED"),
        isMaintenance: stateSet.has("MAINTENANCE"),
        isAllocated: stateSet.has("ALLOCATED"),
        isMixed: stateSet.has("MIXED"),
        isIdle: stateSet.has("IDLE"),
    };
}

/**
 * Check if a node is available for scheduling
 */
export function isNodeAvailable(state?: string[]): boolean {
    const flags = parseNodeState(state);
    return !flags.isDown && !flags.isDraining && !flags.isDrained && !flags.isMaintenance;
}

/**
 * Get the primary state for display purposes
 */
export function getPrimaryNodeState(state?: string[]): NodeState {
    const flags = parseNodeState(state);
    
    if (flags.isDown) return "DOWN";
    if (flags.isDraining) return "DRAINING";
    if (flags.isDrained) return "DRAIN";
    if (flags.isMaintenance) return "RESERVED";
    if (flags.isReserved) return "RESERVED";
    if (flags.isAllocated) return "ALLOCATED";
    if (flags.isMixed) return "MIXED";
    if (flags.isIdle) return "IDLE";
    return "UNKNOWN";
}

// -----------------------------------------------------------------------------
// Partition State Helpers
// -----------------------------------------------------------------------------

export function getPartitionState(partition: { 
    state?: string[] | { current?: string[] };
    partition?: { state?: string[] };
}): string {
    // Check nested partition.state first (common API structure)
    if (partition.partition?.state?.length) {
        return partition.partition.state[0];
    }
    // Check top-level state as array
    if (Array.isArray(partition.state)) {
        return partition.state[0] ?? "UNKNOWN";
    }
    // Check top-level state.current
    return (partition.state as any)?.current?.[0] ?? "UNKNOWN";
}

// -----------------------------------------------------------------------------
// Resource Categorization
// -----------------------------------------------------------------------------

export interface ResourceCategory {
    name: string;
    icon: string;
    resources: { type: string; name: string; count: number }[];
}

export function categorizeResources(tres: { type: string; name: string; count: number }[]): ResourceCategory[] {
    const categories: Record<string, ResourceCategory> = {
        compute: { name: "Compute", icon: "cpu", resources: [] },
        memory: { name: "Memory", icon: "memory", resources: [] },
        gpu: { name: "GPU", icon: "gpu", resources: [] },
        storage: { name: "Storage", icon: "storage", resources: [] },
        network: { name: "Network", icon: "network", resources: [] },
        other: { name: "Other", icon: "other", resources: [] },
    };

    for (const resource of tres) {
        if (resource.count <= 0) continue;
        
        const type = resource.type?.toLowerCase() || "";
        const name = resource.name?.toLowerCase() || "";
        
        if (type === "cpu" || type === "node") {
            categories.compute.resources.push(resource);
        } else if (type === "mem" || type === "memory") {
            categories.memory.resources.push(resource);
        } else if (type === "gres" && name.includes("gpu")) {
            categories.gpu.resources.push(resource);
        } else if (type === "gres" || type === "fs") {
            categories.storage.resources.push(resource);
        } else if (type === "license") {
            categories.network.resources.push(resource);
        } else {
            categories.other.resources.push(resource);
        }
    }

    return Object.values(categories).filter(c => c.resources.length > 0);
}

// -----------------------------------------------------------------------------
// Sorting & Filtering
// -----------------------------------------------------------------------------

export type SortDirection = "asc" | "desc";

export function sortByKey<T>(items: T[], key: keyof T, direction: SortDirection = "asc"): T[] {
    return [...items].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        
        if (aVal === bVal) return 0;
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        
        const comparison = aVal < bVal ? -1 : 1;
        return direction === "asc" ? comparison : -comparison;
    });
}
