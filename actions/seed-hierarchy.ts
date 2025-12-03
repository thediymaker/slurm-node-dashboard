'use server'

import { importHierarchyCSV, importMappingCSV } from "./hierarchy-import";
import fs from "fs/promises";
import path from "path";

export async function seedDefaultHierarchy() {
  try {
    const hierarchyPath = path.join(process.cwd(), 'public', 'asu_hierarchy.csv');
    const mappingsPath = path.join(process.cwd(), 'public', 'asu_mappings.csv');
    
    const hierarchyContent = await fs.readFile(hierarchyPath, 'utf-8');
    const mappingsContent = await fs.readFile(mappingsPath, 'utf-8');
    
    await importHierarchyCSV(hierarchyContent);
    await importMappingCSV(mappingsContent);
    
    return { success: true };
  } catch (error) {
    console.error("Failed to seed hierarchy:", error);
    return { success: false, error: String(error) };
  }
}
