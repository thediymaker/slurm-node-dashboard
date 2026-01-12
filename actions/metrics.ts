'use server'

import { getMetricsDb } from "@/lib/metrics-db";

export interface MetricsFilters {
  startDate?: Date;
  endDate?: Date;
  clusters?: string[];
  accounts?: string[];
  users?: string[];
  colleges?: string[];
  departments?: string[];
  search?: string;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  cluster: string;
}

export interface GroupData {
  name: string;
  value: number;
}

export interface JobStateData {
  state: string;
  count: number;
}

export interface DashboardStats {
  totalJobs: number;
  totalCoreHours: number;
  activeUsers: number;
  avgWaitTime: number;
  totalGpuHours: number;
  gpuJobs: number;
}

function buildWhereClause(filters: MetricsFilters, paramOffset: number = 0, tablePrefix: string = '') {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = paramOffset + 1;
  const p = tablePrefix ? `${tablePrefix}.` : '';

  if (filters.startDate) {
    conditions.push(`${p}end_time >= $${idx++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`${p}end_time <= $${idx++}`);
    params.push(filters.endDate);
  }

  if (filters.clusters && filters.clusters.length > 0) {
    conditions.push(`${p}cluster = ANY($${idx++})`);
    params.push(filters.clusters);
  }

  if (filters.accounts && filters.accounts.length > 0) {
    // Subquery to match account names
    conditions.push(`${p}account_id IN (SELECT id FROM accounts WHERE name = ANY($${idx++}))`);
    params.push(filters.accounts);
  }

  if (filters.users && filters.users.length > 0) {
    conditions.push(`${p}user_id IN (SELECT id FROM users WHERE name = ANY($${idx++}))`);
    params.push(filters.users);
  }

  if (filters.colleges && filters.colleges.length > 0) {
    // Filter by college (parent org)
    // Find accounts mapped to orgs that have these colleges as parents
    conditions.push(`${p}account_id IN (
      SELECT am.account_id 
      FROM account_mappings am
      JOIN organizations o ON am.organization_id = o.id
      JOIN organizations p ON o.parent_id = p.id
      WHERE p.name = ANY($${idx++})
    )`);
    params.push(filters.colleges);
  }

  if (filters.departments && filters.departments.length > 0) {
    // Filter by department (direct org)
    conditions.push(`${p}account_id IN (
      SELECT am.account_id 
      FROM account_mappings am
      JOIN organizations o ON am.organization_id = o.id
      WHERE o.name = ANY($${idx++})
    )`);
    params.push(filters.departments);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    conditions.push(`(
      ${p}user_id IN (SELECT id FROM users WHERE name ILIKE $${idx})
      OR
      ${p}account_id IN (SELECT id FROM accounts WHERE name ILIKE $${idx})
      OR
      ${p}account_id IN (
        SELECT am.account_id 
        FROM account_mappings am
        JOIN organizations o ON am.organization_id = o.id
        WHERE o.name ILIKE $${idx}
      )
    )`);
    params.push(searchPattern);
    idx++;
  }

  return {
    where: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params
  };
}

export async function getFilterOptions() {
  const pool = getMetricsDb();
  try {
    const [clusters, accounts, users, colleges, departments] = await Promise.all([
      pool.query('SELECT DISTINCT cluster FROM job_history ORDER BY cluster'),
      pool.query('SELECT name FROM accounts ORDER BY name'),
      pool.query('SELECT name FROM users ORDER BY name LIMIT 1000'),
      pool.query("SELECT name FROM organizations WHERE type = 'college' OR type = 'root' ORDER BY name"),
      pool.query("SELECT name FROM organizations WHERE type = 'department' ORDER BY name")
    ]);

    return {
      clusters: clusters.rows.map((r: any) => r.cluster),
      accounts: accounts.rows.map((r: any) => r.name),
      users: users.rows.map((r: any) => r.name),
      colleges: colleges.rows.map((r: any) => r.name),
      departments: departments.rows.map((r: any) => r.name)
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return { clusters: [], accounts: [], users: [], colleges: [], departments: [] };
  }
}

export async function getDashboardStats(filters: MetricsFilters): Promise<DashboardStats> {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  const query = `
    SELECT 
      COUNT(*) as total_jobs,
      COALESCE(SUM(core_hours), 0) as total_core_hours,
      COUNT(DISTINCT user_id) as active_users,
      COALESCE(AVG(wait_time_seconds), 0) as avg_wait_time,
      COALESCE(SUM(gpu_hours), 0) as total_gpu_hours,
      COUNT(*) FILTER (WHERE gpu_count > 0) as gpu_jobs
    FROM job_history
    ${where}
  `;

  try {
    const result = await pool.query(query, params);
    const row = result.rows[0];
    return {
      totalJobs: parseInt(row.total_jobs),
      totalCoreHours: parseFloat(row.total_core_hours),
      activeUsers: parseInt(row.active_users),
      avgWaitTime: parseFloat(row.avg_wait_time),
      totalGpuHours: parseFloat(row.total_gpu_hours || 0),
      gpuJobs: parseInt(row.gpu_jobs || 0)
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { totalJobs: 0, totalCoreHours: 0, activeUsers: 0, avgWaitTime: 0, totalGpuHours: 0, gpuJobs: 0 };
  }
}

export async function getTimeSeriesData(filters: MetricsFilters, metric: 'coreHours' | 'jobCount') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  const agg = metric === 'coreHours' ? 'SUM(core_hours)' : 'COUNT(*)';

  try {
    const query = `
      SELECT 
        DATE(end_time) as date,
        cluster,
        ${agg} as value
      FROM job_history
      ${where}
      GROUP BY DATE(end_time), cluster
      ORDER BY date ASC
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      value: parseFloat(row.value),
      cluster: row.cluster
    }));
  } catch (error) {
    console.error('Database Error (getTimeSeriesData):', error);
    return [];
  }
}

export async function getGpuTimeSeriesData(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        DATE(end_time) as date,
        SUM(gpu_hours) as gpu_hours,
        COUNT(*) FILTER (WHERE gpu_count > 0) as gpu_jobs
      FROM job_history
      ${where}
      GROUP BY DATE(end_time)
      ORDER BY date ASC
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      gpuHours: parseFloat(row.gpu_hours || 0),
      gpuJobs: parseInt(row.gpu_jobs || 0)
    }));
  } catch (error) {
    console.error('Database Error (getGpuTimeSeriesData):', error);
    return [];
  }
}

export async function getGpuByPartition(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        partition as name,
        SUM(gpu_hours) as value,
        COUNT(*) FILTER (WHERE gpu_count > 0) as job_count
      FROM job_history
      ${where} AND gpu_count > 0
      GROUP BY partition
      ORDER BY value DESC
      LIMIT 10
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.name || 'Unknown',
      value: parseFloat(row.value || 0),
      jobCount: parseInt(row.job_count || 0)
    }));
  } catch (error) {
    console.error('Database Error (getGpuByPartition):', error);
    return [];
  }
}

export async function getGpuTopUsers(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        user_id as name,
        SUM(gpu_hours) as value,
        COUNT(*) FILTER (WHERE gpu_count > 0) as job_count
      FROM job_history
      ${where} AND gpu_count > 0
      GROUP BY user_id
      ORDER BY value DESC
      LIMIT 10
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.name || 'Unknown',
      value: parseFloat(row.value || 0),
      jobCount: parseInt(row.job_count || 0)
    }));
  } catch (error) {
    console.error('Database Error (getGpuTopUsers):', error);
    return [];
  }
}

export async function getGpuByHierarchy(filters: MetricsFilters, level: 'college' | 'department') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters, 0, 'j');

  // level 'department' = direct mapping (e.g. B1343)
  // level 'college' = parent of direct mapping (e.g. FSE)

  const groupByCol = level === 'department' ? 'o.name' : 'p.name';
  const joinType = level === 'college' ? 'LEFT JOIN organizations p ON o.parent_id = p.id' : '';

  try {
    const query = `
      SELECT 
        ${groupByCol} as name,
        SUM(j.gpu_hours) as value,
        COUNT(*) FILTER (WHERE j.gpu_count > 0) as job_count
      FROM job_history j
      JOIN account_mappings am ON j.account_id = am.account_id
      JOIN organizations o ON am.organization_id = o.id
      ${joinType}
      ${where} AND j.gpu_count > 0
      GROUP BY ${groupByCol}
      HAVING ${groupByCol} IS NOT NULL
      ORDER BY value DESC
      LIMIT 10
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.name || 'Unknown',
      value: parseFloat(row.value || 0),
      jobCount: parseInt(row.job_count || 0)
    }));
  } catch (error) {
    console.error('Database Error (getGpuByHierarchy):', error);
    return [];
  }
}

export async function getGpuHeatmapData(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        EXTRACT(DOW FROM start_time) as day_of_week,
        EXTRACT(HOUR FROM start_time) as hour_of_day,
        COUNT(*) as job_count,
        SUM(gpu_hours) as total_gpu_hours
      FROM job_history
      ${where} AND gpu_count > 0 AND start_time IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;

    const result = await pool.query(query, params);

    // Initialize 7x24 grid with zeros
    const grid: { day: number; hour: number; value: number; jobs: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        grid.push({ day: d, hour: h, value: 0, jobs: 0 });
      }
    }

    // Fill with data
    result.rows.forEach((row: any) => {
      const d = parseInt(row.day_of_week);
      const h = parseInt(row.hour_of_day);
      const idx = d * 24 + h;
      if (grid[idx]) {
        grid[idx].value = parseFloat(row.total_gpu_hours || 0);
        grid[idx].jobs = parseInt(row.job_count || 0);
      }
    });

    return grid;
  } catch (error) {
    console.error('Database Error (getGpuHeatmapData):', error);
    return [];
  }
}

export async function getGpuScatterData(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        job_id,
        user_id,
        gpu_count,
        (EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0) as duration_hours
      FROM job_history
      ${where} 
      AND gpu_count > 0 
      AND start_time IS NOT NULL 
      AND end_time IS NOT NULL
      ORDER BY end_time DESC
      LIMIT 200
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      jobId: row.job_id,
      user: row.user_id,
      gpuCount: parseInt(row.gpu_count),
      duration: parseFloat(row.duration_hours || 0)
    }));
  } catch (error) {
    console.error('Database Error (getGpuScatterData):', error);
    return [];
  }
}

export async function getGroupData(filters: MetricsFilters, metric: 'coreHours' | 'jobCount') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters, 0, 'j');

  const agg = metric === 'coreHours' ? 'SUM(j.core_hours)' : 'COUNT(*)';

  try {
    const query = `
      SELECT 
        a.name as account_name,
        ${agg} as value
      FROM job_history j
      JOIN accounts a ON j.account_id = a.id
      ${where} 
      GROUP BY a.name
      ORDER BY value DESC
      LIMIT 10
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.account_name,
      value: parseFloat(row.value)
    }));
  } catch (error) {
    console.error('Database Error (getGroupData):', error);
    return [];
  }
}

export async function getTopUsers(filters: MetricsFilters, metric: 'coreHours' | 'jobCount') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters, 0, 'j');

  const agg = metric === 'coreHours' ? 'SUM(j.core_hours)' : 'COUNT(*)';

  try {
    const query = `
      SELECT 
        u.name as user_name,
        ${agg} as value
      FROM job_history j
      JOIN users u ON j.user_id = u.id
      ${where} 
      GROUP BY u.name
      ORDER BY value DESC
      LIMIT 10
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.user_name,
      value: parseFloat(row.value)
    }));
  } catch (error) {
    console.error('Database Error (getTopUsers):', error);
    return [];
  }
}

export async function getJobStateDistribution(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        job_state as state,
        COUNT(*) as count
      FROM job_history
      ${where}
      GROUP BY job_state
      ORDER BY count DESC
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      state: row.state,
      count: parseInt(row.count)
    }));
  } catch (error) {
    console.error('Database Error (getJobStateDistribution):', error);
    return [];
  }
}

export async function getWaitTimeData(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    const query = `
      SELECT 
        DATE(end_time) as date,
        AVG(wait_time_seconds) / 60 as value
      FROM job_history
      ${where}
      GROUP BY DATE(end_time)
      ORDER BY date ASC
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      value: Math.max(0, parseFloat(row.value)), // Ensure no negative values
      cluster: 'all'
    }));
  } catch (error) {
    console.error('Database Error (getWaitTimeData):', error);
    return [];
  }
}

export async function getPartitionUsage(filters: MetricsFilters, metric: 'coreHours' | 'jobCount') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  const agg = metric === 'coreHours' ? 'SUM(core_hours)' : 'COUNT(*)';

  try {
    const query = `
      SELECT 
        partition,
        ${agg} as value
      FROM job_history
      ${where}
      GROUP BY partition
      ORDER BY value DESC
      LIMIT 10
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.partition || 'Unknown',
      value: parseFloat(row.value)
    }));
  } catch (error) {
    console.error('Database Error (getPartitionUsage):', error);
    return [];
  }
}

export async function getJobDurationDistribution(filters: MetricsFilters) {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters);

  try {
    // Use run_time_seconds if available, otherwise fallback to end - start
    const query = `
      WITH duration_data AS (
        SELECT 
          COALESCE(
            run_time_seconds, 
            EXTRACT(EPOCH FROM (end_time - start_time))
          ) as duration_seconds
        FROM job_history
        ${where}
      ),
      buckets AS (
        SELECT 
          CASE 
            WHEN duration_seconds < 3600 THEN '< 1h'
            WHEN duration_seconds < 21600 THEN '1h - 6h'
            WHEN duration_seconds < 86400 THEN '6h - 1d'
            WHEN duration_seconds < 604800 THEN '1d - 7d'
            ELSE '> 7d'
          END as duration_bucket
        FROM duration_data
        WHERE duration_seconds IS NOT NULL
      )
      SELECT 
        duration_bucket,
        COUNT(*) as count
      FROM buckets
      GROUP BY duration_bucket
      ORDER BY 
        CASE duration_bucket
          WHEN '< 1h' THEN 1
          WHEN '1h - 6h' THEN 2
          WHEN '6h - 1d' THEN 3
          WHEN '1d - 7d' THEN 4
          ELSE 5
        END
    `;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      name: row.duration_bucket,
      value: parseInt(row.count)
    }));
  } catch (error) {
    console.error('Database Error (getJobDurationDistribution):', error);
    return [];
  }
}

export async function getHierarchyTimeSeriesData(filters: MetricsFilters, metric: 'coreHours' | 'jobCount', level: 'department' | 'college') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters, 0, 'j');

  const agg = metric === 'coreHours' ? 'SUM(j.core_hours)' : 'COUNT(*)';
  const groupByCol = level === 'department' ? 'o.name' : 'p.name';
  const joinType = level === 'college' ? 'LEFT JOIN organizations p ON o.parent_id = p.id' : '';

  // Check if date range is small (< 2 days) to switch to hourly grouping
  const isShortRange = filters.startDate && filters.endDate &&
    (filters.endDate.getTime() - filters.startDate.getTime()) < 2 * 24 * 60 * 60 * 1000;

  const timeGroup = isShortRange
    ? "DATE_TRUNC('hour', j.end_time)"
    : "DATE(j.end_time)";

  try {
    const query = `
      SELECT 
        ${timeGroup} as date,
        ${groupByCol} as name,
        ${agg} as value
      FROM job_history j
      JOIN account_mappings am ON j.account_id = am.account_id
      JOIN organizations o ON am.organization_id = o.id
      ${joinType}
      ${where}
      GROUP BY ${timeGroup}, ${groupByCol}
      ORDER BY date ASC
    `;

    const result = await pool.query(query, params);

    // Transform for Recharts with Zero-Filling
    const entities = new Set<string>();
    result.rows.forEach((row: any) => {
      if (row.name) entities.add(row.name);
    });
    const entityList = Array.from(entities);

    const dataMap = new Map<string, any>();

    // Determine range
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let current = new Date(startDate);

    // Align start
    if (isShortRange) {
      current.setMinutes(0, 0, 0);
    } else {
      current.setHours(0, 0, 0, 0);
    }

    // Generate all time slots
    while (current <= endDate) {
      const dateStr = isShortRange
        ? current.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
        : current.toISOString().split('T')[0];

      const entry: any = { date: dateStr };
      entityList.forEach(e => entry[e] = 0);
      dataMap.set(dateStr, entry);

      // Increment
      if (isShortRange) {
        current = new Date(current.getTime() + 60 * 60 * 1000); // Add 1 hour
      } else {
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
      }
    }

    // Fill with data
    result.rows.forEach((row: any) => {
      if (!row.name) return;
      const dateObj = new Date(row.date);
      const dateStr = isShortRange
        ? dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
        : dateObj.toISOString().split('T')[0];

      if (dataMap.has(dateStr)) {
        const entry = dataMap.get(dateStr);
        entry[row.name] = parseFloat(row.value);
      }
    });

    return {
      data: Array.from(dataMap.values()),
      entities: entityList
    };

  } catch (error) {
    console.error('Database Error (getHierarchyTimeSeriesData):', error);
    return { data: [], entities: [] };
  }
}

export async function getHierarchyUsage(filters: MetricsFilters, metric: 'coreHours' | 'jobCount', level: 'department' | 'college') {
  const pool = getMetricsDb();
  const { where, params } = buildWhereClause(filters, 0, 'j');

  // If coreHours is huge (seconds), divide by 3600? 
  // Assuming the user's data is in seconds if it's > 1M for a small test.
  // But to be safe, let's just use the raw value for now, or maybe the user can fix the ingestor.
  // Actually, let's add a DISTINCT to the join to prevent multiplication if mappings are duplicated.

  const agg = metric === 'coreHours' ? 'SUM(j.core_hours)' : 'COUNT(DISTINCT j.job_id)';

  // level 'department' = direct mapping (e.g. B1343)
  // level 'college' = parent of direct mapping (e.g. FSE)

  const groupByCol = level === 'department' ? 'o.name' : 'p.name';
  const joinType = level === 'college' ? 'LEFT JOIN organizations p ON o.parent_id = p.id' : '';

  try {
    const query = `
      SELECT 
        ${groupByCol} as name,
        ${agg} as value
      FROM job_history j
      JOIN account_mappings am ON j.account_id = am.account_id
      JOIN organizations o ON am.organization_id = o.id
      ${joinType}
      ${where}
      GROUP BY ${groupByCol}
      ORDER BY value DESC
      LIMIT 15
    `;

    const result = await pool.query(query, params);

    return result.rows
      .filter((row: any) => row.name != null) // Filter out nulls if parent doesn't exist
      .map((row: any) => ({
        name: row.name,
        value: parseFloat(row.value)
      }));
  } catch (error) {
    console.error('Database Error (getHierarchyUsage):', error);
    return [];
  }
}
