import { Pool } from 'pg';

let pool: InstanceType<typeof Pool> | undefined;

export function getMetricsDb(): InstanceType<typeof Pool> | null {
  // Return null if database URL is not configured
  if (!process.env.SLURM_JOB_METRICS_DATABASE_URL) {
    return null;
  }
  
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SLURM_JOB_METRICS_DATABASE_URL,
      max: 10, // Limit max connections
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
