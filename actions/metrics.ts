"use server";

import { getMetricsDb } from "@/lib/metrics-db";
import { unstable_cache } from "next/cache";

// The metrics page's filter choices. Its panels are queried by lib/metrics/*
// on the server when the page renders.

export interface MetricsFilterOptions {
  clusters: string[];
  accounts: string[];
  users: string[];
  colleges: string[];
  departments: string[];
  partitions: string[];
  qos: string[];
  // Some accounts are mapped to the college/department hierarchy
  hierarchy: boolean;
}

const EMPTY: MetricsFilterOptions = {
  clusters: [],
  accounts: [],
  users: [],
  colleges: [],
  departments: [],
  partitions: [],
  qos: [],
  hierarchy: false,
};

async function getFilterOptionsInternal(): Promise<MetricsFilterOptions> {
  const pool = getMetricsDb();
  if (!pool) return EMPTY;
  try {
    // Partitions and QoS from the last year's jobs, which the end_time index
    // keeps cheap on large histories
    const [clusters, accounts, users, colleges, departments, partitions, qos, mapped] = await Promise.all([
      pool.query("SELECT DISTINCT cluster FROM job_history ORDER BY cluster"),
      pool.query("SELECT name FROM accounts ORDER BY name"),
      pool.query("SELECT name FROM users ORDER BY name LIMIT 1000"),
      pool.query("SELECT name FROM organizations WHERE type = 'college' OR type = 'root' ORDER BY name"),
      pool.query("SELECT name FROM organizations WHERE type = 'department' ORDER BY name"),
      pool.query(`SELECT DISTINCT partition AS v FROM job_history
                  WHERE end_time > now() - interval '1 year' AND partition <> '' ORDER BY 1`),
      pool.query(`SELECT DISTINCT qos AS v FROM job_history
                  WHERE end_time > now() - interval '1 year' AND qos <> '' ORDER BY 1`),
      pool.query("SELECT EXISTS (SELECT 1 FROM account_mappings) AS mapped"),
    ]);

    return {
      clusters: clusters.rows.map((r: { cluster: string }) => r.cluster),
      accounts: accounts.rows.map((r: { name: string }) => r.name),
      users: users.rows.map((r: { name: string }) => r.name),
      colleges: colleges.rows.map((r: { name: string }) => r.name),
      departments: departments.rows.map((r: { name: string }) => r.name),
      partitions: partitions.rows.map((r: { v: string }) => r.v),
      qos: qos.rows.map((r: { v: string }) => r.v),
      hierarchy: Boolean(mapped.rows[0]?.mapped),
    };
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return EMPTY;
  }
}

// Cache filter options for 5 minutes since they change infrequently
export const getFilterOptions = unstable_cache(getFilterOptionsInternal, ["metrics-filter-options"], {
  revalidate: 300,
  tags: ["filter-options", "hierarchy"],
});
