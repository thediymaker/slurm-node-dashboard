'use server'

import { getMetricsDb } from "@/lib/metrics-db";
import { revalidatePath, revalidateTag } from "next/cache";

// Helper to parse CSV line respecting quotes
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

export async function importHierarchyCSV(csvContent: string) {
  const pool = getMetricsDb();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const lines = csvContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    // Parse all lines first
    const entries: { code: string; name: string; parentCode: string | null }[] = [];
    for (const line of lines) {
      const [code, name, parentCode] = parseCSVLine(line);
      if (code && name) {
        entries.push({ code, name, parentCode: parentCode || null });
      }
    }
    
    if (entries.length === 0) {
      await client.query('ROLLBACK');
      return;
    }
    
    // Batch check for existing orgs by name
    const names = entries.map(e => e.name);
    const existingOrgs = await client.query(
      'SELECT id, name FROM organizations WHERE name = ANY($1)',
      [names]
    );
    const existingOrgMap = new Map<string, number>();
    existingOrgs.rows.forEach((row: any) => existingOrgMap.set(row.name, row.id));
    
    // Separate new orgs from existing
    const newEntries = entries.filter(e => !existingOrgMap.has(e.name));
    
    // Batch insert new organizations
    if (newEntries.length > 0) {
      const insertValues: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;
      
      for (const entry of newEntries) {
        placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
        insertValues.push(entry.name, 'department', entry.code);
      }
      
      const insertResult = await client.query(
        `INSERT INTO organizations (name, type, info) VALUES ${placeholders.join(', ')} RETURNING id, name`,
        insertValues
      );
      
      // Add new IDs to the map
      insertResult.rows.forEach((row: any) => existingOrgMap.set(row.name, row.id));
    }
    
    // Build code to ID mapping
    const codeToId = new Map<string, number>();
    entries.forEach(e => {
      const id = existingOrgMap.get(e.name);
      if (id) codeToId.set(e.code, id);
    });
    
    // Batch update parents and types
    const updateParents: { childId: number; parentId: number }[] = [];
    const rootIds: number[] = [];
    
    for (const entry of entries) {
      const childId = codeToId.get(entry.code);
      if (!childId) continue;
      
      if (entry.parentCode) {
        const parentId = codeToId.get(entry.parentCode);
        if (parentId) {
          updateParents.push({ childId, parentId });
        }
      } else {
        rootIds.push(childId);
      }
    }
    
    // Batch update roots
    if (rootIds.length > 0) {
      await client.query(
        'UPDATE organizations SET type = $1, parent_id = NULL WHERE id = ANY($2)',
        ['root', rootIds]
      );
    }
    
    // Batch update parent relationships using UNNEST for efficiency
    if (updateParents.length > 0) {
      const childIds = updateParents.map(u => u.childId);
      const parentIds = updateParents.map(u => u.parentId);
      
      await client.query(
        `UPDATE organizations SET parent_id = data.parent_id 
         FROM (SELECT UNNEST($1::int[]) as id, UNNEST($2::int[]) as parent_id) as data
         WHERE organizations.id = data.id`,
        [childIds, parentIds]
      );
    }
    
    // Infer types based on hierarchy depth (single pass with CTE)
    await client.query(`
      WITH RECURSIVE hierarchy AS (
        SELECT id, parent_id, 1 as depth
        FROM organizations
        WHERE parent_id IS NULL
        UNION ALL
        SELECT o.id, o.parent_id, h.depth + 1
        FROM organizations o
        JOIN hierarchy h ON o.parent_id = h.id
      )
      UPDATE organizations SET type = 
        CASE 
          WHEN (SELECT depth FROM hierarchy WHERE hierarchy.id = organizations.id) = 1 THEN 'root'
          WHEN (SELECT depth FROM hierarchy WHERE hierarchy.id = organizations.id) = 2 THEN 'college'
          WHEN (SELECT depth FROM hierarchy WHERE hierarchy.id = organizations.id) = 3 THEN 'department'
          ELSE 'group'
        END
      WHERE id IN (SELECT id FROM hierarchy)
    `);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  revalidatePath('/admin/hierarchy');
  revalidateTag('hierarchy', 'default');
}

export async function importMappingCSV(csvContent: string) {
  const pool = getMetricsDb();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const lines = csvContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    // Parse all mappings
    const mappings: { slurmAccount: string; orgIdentifier: string }[] = [];
    for (const line of lines) {
      const [slurmAccount, orgIdentifier] = parseCSVLine(line);
      if (slurmAccount && orgIdentifier) {
        mappings.push({ slurmAccount, orgIdentifier });
      }
    }
    
    if (mappings.length === 0) {
      await client.query('ROLLBACK');
      return;
    }
    
    // Get unique values for batch lookups
    const accountNames = [...new Set(mappings.map(m => m.slurmAccount))];
    const orgIdentifiers = [...new Set(mappings.map(m => m.orgIdentifier))];
    
    // Batch lookup organizations (by info/code or name)
    const orgsResult = await client.query(
      'SELECT id, info, name FROM organizations WHERE info = ANY($1) OR name = ANY($1)',
      [orgIdentifiers]
    );
    const orgMap = new Map<string, number>();
    orgsResult.rows.forEach((row: any) => {
      if (row.info) orgMap.set(row.info, row.id);
      if (row.name) orgMap.set(row.name, row.id);
    });
    
    // Batch lookup existing accounts
    const existingAccounts = await client.query(
      'SELECT id, name FROM accounts WHERE name = ANY($1)',
      [accountNames]
    );
    const accountMap = new Map<string, number>();
    existingAccounts.rows.forEach((row: any) => accountMap.set(row.name, row.id));
    
    // Find accounts that need to be created
    const newAccountNames = accountNames.filter(name => !accountMap.has(name));
    
    // Batch insert new accounts
    if (newAccountNames.length > 0) {
      const placeholders = newAccountNames.map((_, i) => `($${i + 1})`).join(', ');
      const insertResult = await client.query(
        `INSERT INTO accounts (name) VALUES ${placeholders} RETURNING id, name`,
        newAccountNames
      );
      insertResult.rows.forEach((row: any) => accountMap.set(row.name, row.id));
    }
    
    // Build valid mappings
    const validMappings: { orgId: number; accountId: number }[] = [];
    for (const mapping of mappings) {
      const orgId = orgMap.get(mapping.orgIdentifier);
      const accountId = accountMap.get(mapping.slurmAccount);
      
      if (orgId && accountId) {
        validMappings.push({ orgId, accountId });
      } else if (!orgId) {
        console.warn(`Org not found for identifier: ${mapping.orgIdentifier}`);
      }
    }
    
    // Batch insert mappings (using ON CONFLICT DO NOTHING)
    if (validMappings.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;
      
      for (const { orgId, accountId } of validMappings) {
        placeholders.push(`($${idx++}, $${idx++})`);
        values.push(orgId, accountId);
      }
      
      await client.query(
        `INSERT INTO account_mappings (organization_id, account_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
        values
      );
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  revalidatePath('/admin/hierarchy');
  revalidateTag('hierarchy', 'default');
}

export async function exportHierarchyCSV() {
  const pool = getMetricsDb();
  const result = await pool.query(`
    SELECT t1.info as code, t1.name, t2.info as parent_code 
    FROM organizations t1 
    LEFT JOIN organizations t2 ON t1.parent_id = t2.id
    ORDER BY t1.id
  `);
  
  // Convert to CSV
  const header = '"code","name","parent_code"';
  const rows = result.rows.map((row: any) => {
    const code = row.code ? `"${row.code.replace(/"/g, '""')}"` : '""';
    const name = row.name ? `"${row.name.replace(/"/g, '""')}"` : '""';
    const parent = row.parent_code ? `"${row.parent_code.replace(/"/g, '""')}"` : '""';
    return `${code},${name},${parent}`;
  });
  
  return [header, ...rows].join('\n');
}

export async function exportMappingCSV() {
  const pool = getMetricsDb();
  const result = await pool.query(`
    SELECT a.name as account_name, o.info as org_code 
    FROM account_mappings am 
    JOIN accounts a ON am.account_id = a.id 
    JOIN organizations o ON am.organization_id = o.id
    ORDER BY a.name
  `);
  
  const header = '"slurm_account","org_code"';
  const rows = result.rows.map((row: any) => {
    const acc = row.account_name ? `"${row.account_name.replace(/"/g, '""')}"` : '""';
    const org = row.org_code ? `"${row.org_code.replace(/"/g, '""')}"` : '""';
    return `${acc},${org}`;
  });
  
  return [header, ...rows].join('\n');
}
