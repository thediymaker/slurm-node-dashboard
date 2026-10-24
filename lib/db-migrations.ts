// Tables the dashboard writes. Applied in order by ensureSchema() in lib/db.ts
// and recorded in dashboard_schema_migrations, separately from the ingestor's
// schema_migrations.
//
// Never edit a migration that has shipped; add a new one. Every statement is
// idempotent (IF NOT EXISTS) because databases set up by the history ingestor
// before 3.0 already contain the shared tables below.

export interface Migration {
  version: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    // Same definitions as the ingestor's migrations, so whichever runs first
    // creates them and the other leaves them alone. accounts is filled by the
    // ingestor; the dashboard only needs it to exist for account_mappings.
    version: "001_shared_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_id INT REFERENCES organizations(id),
        info TEXT,
        CONSTRAINT unique_org_name_type UNIQUE (name, type)
      );

      CREATE TABLE IF NOT EXISTS account_mappings (
        account_id INT NOT NULL REFERENCES accounts(id),
        organization_id INT NOT NULL REFERENCES organizations(id),
        PRIMARY KEY (account_id, organization_id)
      );

      CREATE TABLE IF NOT EXISTS job_gpu_metrics (
        job_id TEXT PRIMARY KEY,
        avg_utilization NUMERIC(5,2) NOT NULL DEFAULT 0,
        max_utilization NUMERIC(5,2) NOT NULL DEFAULT 0,
        min_utilization NUMERIC(5,2) NOT NULL DEFAULT 0,
        avg_memory_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        max_memory_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        gpu_count INTEGER NOT NULL DEFAULT 1,
        sample_count INTEGER NOT NULL DEFAULT 1,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
        is_complete BOOLEAN NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS idx_job_gpu_metrics_is_complete ON job_gpu_metrics (is_complete);
      CREATE INDEX IF NOT EXISTS idx_job_gpu_metrics_last_seen ON job_gpu_metrics (last_seen);
    `,
  },
  {
    // Node history (periods a node was unavailable, and why) and the hourly
    // node snapshots Rewind replays
    version: "002_node_history",
    sql: `
      CREATE TABLE IF NOT EXISTS node_events (
        id BIGSERIAL PRIMARY KEY,
        cluster TEXT NOT NULL,
        node TEXT NOT NULL,
        state TEXT NOT NULL,
        reason TEXT,
        reason_set_by TEXT,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_node_events_node ON node_events (cluster, node, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_node_events_started ON node_events (started_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_node_events_open ON node_events (cluster, node) WHERE ended_at IS NULL;

      CREATE TABLE IF NOT EXISTS node_snapshots (
        cluster TEXT NOT NULL,
        taken_at TIMESTAMPTZ NOT NULL,
        data BYTEA NOT NULL,
        PRIMARY KEY (cluster, taken_at)
      );
    `,
  },
];
