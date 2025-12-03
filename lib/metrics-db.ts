import { Pool } from 'pg';

let pool: Pool | undefined;

export function getMetricsDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SLURM_JOB_METRICS_DATABASE_URL,
      max: 10, // Limit max connections
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
