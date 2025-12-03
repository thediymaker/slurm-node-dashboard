'use server'

import { getMetricsDb } from "@/lib/metrics-db";
import { revalidatePath } from "next/cache";

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
  const lines = csvContent.split('\n');
  
  // First pass: Create all organizations
  // Format: id_code, name, parent_code
  // We need to store the code mapping to ID
  
  // Since the CSV uses codes (e.g. "asu", "wpc") but our DB uses auto-increment IDs,
  // we need to handle this. 
  // Strategy: 
  // 1. Check if org with this name exists. If so, use it.
  // 2. If not, create it.
  // 3. Store a mapping of code -> db_id for the second pass (parenting).
  
  const codeToId = new Map<string, number>();
  const pendingParents: {childId: number, parentCode: string}[] = [];

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const [code, name, parentCode] = parseCSVLine(line);
    
    if (!code || !name) continue;

    // Determine type based on parentCode or context? 
    // The user didn't provide type in CSV. We might need to guess or default to 'group' if it has a parent, 'root' if not?
    // Actually, let's default to 'department' for now, or maybe infer from hierarchy depth later.
    // For now, let's just insert.
    
    // Check if exists by name
    let res = await pool.query('SELECT id FROM organizations WHERE name = $1', [name]);
    let id: number;
    
    if ((res.rowCount ?? 0) > 0) {
      id = res.rows[0].id;
    } else {
      // Create
      const insertRes = await pool.query(
        'INSERT INTO organizations (name, type, info) VALUES ($1, $2, $3) RETURNING id',
        [name, 'department', code] // Storing code in info for reference
      );
      id = insertRes.rows[0].id;
    }
    
    codeToId.set(code, id);
    
    if (parentCode) {
      pendingParents.push({ childId: id, parentCode });
    } else {
        // It's a root, update type
        await pool.query('UPDATE organizations SET type = $1 WHERE id = $2', ['root', id]);
    }
  }
  
  // Second pass: Update parents
  for (const { childId, parentCode } of pendingParents) {
    const parentId = codeToId.get(parentCode);
    if (parentId) {
      await pool.query('UPDATE organizations SET parent_id = $1 WHERE id = $2', [parentId, childId]);
      
      // Try to infer type based on parent
      // If parent is root, child is college?
      // If parent is college, child is department?
      // This is heuristic.
      const parentRes = await pool.query('SELECT type FROM organizations WHERE id = $1', [parentId]);
      if ((parentRes.rowCount ?? 0) > 0) {
          const pType = parentRes.rows[0].type;
          let newType = 'group';
          if (pType === 'root') newType = 'college';
          else if (pType === 'college') newType = 'department';
          else if (pType === 'department') newType = 'group';
          
          await pool.query('UPDATE organizations SET type = $1 WHERE id = $2', [newType, childId]);
      }
    }
  }
  
  revalidatePath('/admin/hierarchy');
}

export async function importMappingCSV(csvContent: string) {
  const pool = getMetricsDb();
  const lines = csvContent.split('\n');
  
  // Format: slurm_account, org_code_or_name
  // "grp_aajoshi7","B1343"
  
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const [slurmAccount, orgIdentifier] = parseCSVLine(line);
    
    if (!slurmAccount || !orgIdentifier) continue;
    
    // Find the org by info (code) or name
    let orgRes = await pool.query('SELECT id FROM organizations WHERE info = $1 OR name = $1', [orgIdentifier]);
    if ((orgRes.rowCount ?? 0) === 0) {
        // Try finding by partial name? No, strict for now.
        console.warn(`Org not found for identifier: ${orgIdentifier}`);
        continue;
    }
    const orgId = orgRes.rows[0].id;
    
    // Find the account ID
    let accRes = await pool.query('SELECT id FROM accounts WHERE name = $1', [slurmAccount]);
    let accountId: number;
    
    if ((accRes.rowCount ?? 0) === 0) {
        // Create account if not exists? Or skip?
        // Usually accounts are synced from Slurm. But we can create a placeholder.
        const ins = await pool.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [slurmAccount]);
        accountId = ins.rows[0].id;
    } else {
        accountId = accRes.rows[0].id;
    }
    
    // Map
    await pool.query(
        `INSERT INTO account_mappings (organization_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [orgId, accountId]
    );
  }
  
  revalidatePath('/admin/hierarchy');
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
