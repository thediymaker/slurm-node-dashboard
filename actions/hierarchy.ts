'use server'

import { getMetricsDb } from "@/lib/metrics-db";
import { revalidatePath } from "next/cache";

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

export async function getHierarchy() {
  const pool = getMetricsDb();
  // Fetch all organizations
  const result = await pool.query<Organization>(`
    SELECT id, name, type, parent_id, info 
    FROM organizations 
    ORDER BY name
  `);
  
  const orgs = result.rows;
  
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
}

export async function getFlatHierarchy() {
    const pool = getMetricsDb();
    const result = await pool.query<Organization>(`
      SELECT id, name, type, parent_id, info 
      FROM organizations 
      ORDER BY name
    `);
    return result.rows;
}

export async function createOrganization(data: { name: string; type: string; parent_id?: number | null; info?: string }) {
  const pool = getMetricsDb();
  await pool.query(
    `INSERT INTO organizations (name, type, parent_id, info) VALUES ($1, $2, $3, $4)`,
    [data.name, data.type, data.parent_id || null, data.info || null]
  );
  revalidatePath('/admin/hierarchy');
}

export async function updateOrganization(id: number, data: { name: string; type: string; parent_id?: number | null; info?: string }) {
  const pool = getMetricsDb();
  await pool.query(
    `UPDATE organizations SET name = $1, type = $2, parent_id = $3, info = $4 WHERE id = $5`,
    [data.name, data.type, data.parent_id || null, data.info || null, id]
  );
  revalidatePath('/admin/hierarchy');
}

export async function deleteOrganization(id: number) {
  const pool = getMetricsDb();
  // Check for children
  const children = await pool.query('SELECT id FROM organizations WHERE parent_id = $1', [id]);
  if ((children.rowCount ?? 0) > 0) {
    throw new Error("Cannot delete organization with children");
  }
  
  await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
  revalidatePath('/admin/hierarchy');
}

export async function getAccounts() {
    const pool = getMetricsDb();
    const result = await pool.query<Account>('SELECT id, name FROM accounts ORDER BY name');
    return result.rows;
}

export async function getAccountMappings(orgId: number) {
    const pool = getMetricsDb();
    const result = await pool.query<{account_id: number, account_name: string}>(`
        SELECT am.account_id, a.name as account_name
        FROM account_mappings am
        JOIN accounts a ON am.account_id = a.id
        WHERE am.organization_id = $1
    `, [orgId]);
    return result.rows;
}

export async function addAccountMapping(orgId: number, accountId: number) {
    const pool = getMetricsDb();
    await pool.query(
        `INSERT INTO account_mappings (organization_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [orgId, accountId]
    );
    revalidatePath('/admin/hierarchy');
}

export async function removeAccountMapping(orgId: number, accountId: number) {
    const pool = getMetricsDb();
    await pool.query(
        `DELETE FROM account_mappings WHERE organization_id = $1 AND account_id = $2`,
        [orgId, accountId]
    );
    revalidatePath('/admin/hierarchy');
}

export async function deleteAllHierarchy() {
  const pool = getMetricsDb();
  // Delete mappings first due to foreign key constraints
  await pool.query('DELETE FROM account_mappings');
  // Delete organizations
  await pool.query('DELETE FROM organizations');
  revalidatePath('/admin/hierarchy');
}
