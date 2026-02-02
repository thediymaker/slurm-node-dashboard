'use server'

import { getMetricsDb } from "@/lib/metrics-db";
import { revalidatePath, unstable_cache } from "next/cache";

export interface Organization {
  id: number;
  name: string;
  type: string;
  parent_id: number | null;
  info: string | null;
  children?: Organization[];
}

export interface Account {
  id: number;
  name: string;
}

async function getHierarchyInternal() {
  const pool = getMetricsDb();
  if (!pool) {
    return []; // Return empty array if database is not configured
  }
  
  try {
    // Fetch all organizations
    const result = await pool.query(`
      SELECT id, name, type, parent_id, info 
      FROM organizations 
      ORDER BY name
    `);
    
    const orgs = result.rows as Organization[];
    
    // Build tree
    const orgMap = new Map<number, Organization>();
    orgs.forEach(org => {
      org.children = [];
      orgMap.set(org.id, org);
    });
    
    const root: Organization[] = [];
    
    orgs.forEach(org => {
      if (org.parent_id) {
        const parent = orgMap.get(org.parent_id);
        if (parent) {
          parent.children?.push(org);
        } else {
          // Parent not found, treat as root or orphan
          root.push(org);
        }
      } else {
        root.push(org);
      }
    });
    
    return root;
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    return [];
  }
}

export const getHierarchy = unstable_cache(
  getHierarchyInternal,
  ['hierarchy'],
  { revalidate: 300, tags: ['hierarchy'] } // Cache for 5 minutes
);

// Uncached version for client-side refresh after mutations
export async function getHierarchyFresh() {
  return getHierarchyInternal();
}

async function getFlatHierarchyInternal() {
    const pool = getMetricsDb();
    if (!pool) {
      return []; // Return empty array if database is not configured
    }
    
    try {
      const result = await pool.query(`
        SELECT id, name, type, parent_id, info 
        FROM organizations 
        ORDER BY name
      `);
      return result.rows as Organization[];
    } catch (error) {
      console.error('Error fetching flat hierarchy:', error);
      return [];
    }
}

export const getFlatHierarchy = unstable_cache(
  getFlatHierarchyInternal,
  ['flat-hierarchy'],
  { revalidate: 300, tags: ['hierarchy'] } // Cache for 5 minutes
);

// Uncached version for client-side refresh after mutations
export async function getFlatHierarchyFresh() {
  return getFlatHierarchyInternal();
}

export async function createOrganization(data: { name: string; type: string; parent_id?: number | null; info?: string }) {
  const pool = getMetricsDb();
  if (!pool) {
    throw new Error('Database not configured. Enable the metrics database to use hierarchy features.');
  }
  await pool.query(
    `INSERT INTO organizations (name, type, parent_id, info) VALUES ($1, $2, $3, $4)`,
    [data.name, data.type, data.parent_id || null, data.info || null]
  );
  revalidatePath('/admin/hierarchy');
  // Invalidate hierarchy caches
  const { revalidateTag } = await import('next/cache');
  revalidateTag('hierarchy');
}

export async function updateOrganization(id: number, data: { name: string; type: string; parent_id?: number | null; info?: string }) {
  const pool = getMetricsDb();
  if (!pool) {
    throw new Error('Database not configured. Enable the metrics database to use hierarchy features.');
  }
  await pool.query(
    `UPDATE organizations SET name = $1, type = $2, parent_id = $3, info = $4 WHERE id = $5`,
    [data.name, data.type, data.parent_id || null, data.info || null, id]
  );
  revalidatePath('/admin/hierarchy');
  const { revalidateTag } = await import('next/cache');
  revalidateTag('hierarchy');
}

export async function deleteOrganization(id: number) {
  const pool = getMetricsDb();
  if (!pool) {
    throw new Error('Database not configured. Enable the metrics database to use hierarchy features.');
  }
  // Check for children
  const children = await pool.query('SELECT id FROM organizations WHERE parent_id = $1', [id]);
  if ((children.rowCount ?? 0) > 0) {
    throw new Error("Cannot delete organization with children");
  }
  
  await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
  revalidatePath('/admin/hierarchy');
  const { revalidateTag } = await import('next/cache');
  revalidateTag('hierarchy');
}

async function getAccountsInternal() {
    const pool = getMetricsDb();
    if (!pool) {
      return []; // Return empty array if database is not configured
    }
    
    try {
      const result = await pool.query('SELECT id, name FROM accounts ORDER BY name');
      return result.rows as Account[];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
}

export const getAccounts = unstable_cache(
  getAccountsInternal,
  ['accounts'],
  { revalidate: 300, tags: ['accounts'] } // Cache for 5 minutes
);

export async function getAccountMappings(orgId: number) {
    const pool = getMetricsDb();
    if (!pool) {
      return [];
    }
    try {
      const result = await pool.query(`
          SELECT am.account_id, a.name as account_name
          FROM account_mappings am
          JOIN accounts a ON am.account_id = a.id
          WHERE am.organization_id = $1
      `, [orgId]);
      return result.rows as {account_id: number, account_name: string}[];
    } catch (error) {
      console.error('Error fetching account mappings:', error);
      return [];
    }
}

export async function addAccountMapping(orgId: number, accountId: number) {
    const pool = getMetricsDb();
    if (!pool) {
      throw new Error('Database not configured. Enable the metrics database to use hierarchy features.');
    }
    await pool.query(
        `INSERT INTO account_mappings (organization_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [orgId, accountId]
    );
    revalidatePath('/admin/hierarchy');
    const { revalidateTag } = await import('next/cache');
    revalidateTag('hierarchy');
}

export async function removeAccountMapping(orgId: number, accountId: number) {
    const pool = getMetricsDb();
    if (!pool) {
      throw new Error('Database not configured. Enable the metrics database to use hierarchy features.');
    }
    await pool.query(
        `DELETE FROM account_mappings WHERE organization_id = $1 AND account_id = $2`,
        [orgId, accountId]
    );
    revalidatePath('/admin/hierarchy');
    const { revalidateTag } = await import('next/cache');
    revalidateTag('hierarchy');
}

export async function deleteAllHierarchy() {
  const pool = getMetricsDb();
  if (!pool) {
    throw new Error('Database not configured. Enable the metrics database to use hierarchy features.');
  }
  // Delete mappings first due to foreign key constraints
  await pool.query('DELETE FROM account_mappings');
  // Delete organizations
  await pool.query('DELETE FROM organizations');
  revalidatePath('/admin/hierarchy');
  const { revalidateTag } = await import('next/cache');
  revalidateTag('hierarchy');
  revalidateTag('accounts');
}
