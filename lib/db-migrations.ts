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
  {
    // How long each node spent in each state (full, partial, idle, drained,
    // down...) per hour, for the node history bar. Hourly totals keep the size
    // fixed however often jobs start and end.
    version: "003_node_state_time",
    sql: `
      CREATE TABLE IF NOT EXISTS node_state_time (
        cluster TEXT NOT NULL,
        node TEXT NOT NULL,
        hour TIMESTAMPTZ NOT NULL,
        state TEXT NOT NULL,
        seconds INTEGER NOT NULL,
        PRIMARY KEY (cluster, node, hour, state)
      );
      CREATE INDEX IF NOT EXISTS idx_node_state_time_hour ON node_state_time (hour);
    `,
  },
  {
    // Core- and GPU-seconds each cluster had per hour: in total, on nodes that
    // could run jobs, and allocated. The metrics page divides allocated core
    // hours by available capacity for utilization.
    version: "004_cluster_capacity",
    sql: `
      CREATE TABLE IF NOT EXISTS cluster_capacity (
        cluster TEXT NOT NULL,
        hour TIMESTAMPTZ NOT NULL,
        cpu_seconds_total BIGINT NOT NULL DEFAULT 0,
        cpu_seconds_available BIGINT NOT NULL DEFAULT 0,
        cpu_seconds_allocated BIGINT NOT NULL DEFAULT 0,
        gpu_seconds_total BIGINT NOT NULL DEFAULT 0,
        gpu_seconds_available BIGINT NOT NULL DEFAULT 0,
        gpu_seconds_allocated BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (cluster, hour)
      );
      CREATE INDEX IF NOT EXISTS idx_cluster_capacity_hour ON cluster_capacity (hour);
    `,
  },
  {
    // Daily rollups of job_history for the metrics page (lib/metrics/rollup.ts):
    // one row per day and combination of the dimensions the page filters and
    // groups by, so a year of reports reads a few hundred thousand rows
    // instead of every job. Usage columns hold the part of each job's run
    // that fell on the day; the rest describe the jobs that ended on it.
    // job_daily_hist holds the distributions behind medians and histograms,
    // job_daily_nodes the jobs per node behind preemption.
    version: "005_metrics_rollups",
    sql: `
      CREATE TABLE IF NOT EXISTS metrics_rollup_state (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        definition TEXT,
        time_zone TEXT,
        ready BOOLEAN NOT NULL DEFAULT false,
        max_job_seconds BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS metrics_rollup_dirty (
        day DATE PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS job_daily (
        day DATE NOT NULL,
        cluster TEXT NOT NULL,
        partition TEXT,
        qos TEXT,
        account_id INT,
        user_id INT,
        state TEXT NOT NULL,
        size_bucket TEXT NOT NULL,
        wall_bucket TEXT NOT NULL,
        run_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        cpu_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        gpu_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        node_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        gpu_util_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        gpu_known_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        jobs INT NOT NULL DEFAULT 0,
        short_jobs INT NOT NULL DEFAULT 0,
        wait_n INT NOT NULL DEFAULT 0,
        wait_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        cpus_n INT NOT NULL DEFAULT 0,
        cpus_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
        runtime_n INT NOT NULL DEFAULT 0,
        runtime_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        core_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        eligible_jobs INT NOT NULL DEFAULT 0,
        eligible_core_s DOUBLE PRECISION NOT NULL DEFAULT 0,
        cpu_used DOUBLE PRECISION NOT NULL DEFAULT 0,
        cpu_alloc DOUBLE PRECISION NOT NULL DEFAULT 0,
        mem_n INT NOT NULL DEFAULT 0,
        mem_used DOUBLE PRECISION NOT NULL DEFAULT 0,
        mem_req DOUBLE PRECISION NOT NULL DEFAULT 0,
        wall_used_min DOUBLE PRECISION NOT NULL DEFAULT 0,
        wall_limit_min DOUBLE PRECISION NOT NULL DEFAULT 0,
        gpu_eff_w DOUBLE PRECISION NOT NULL DEFAULT 0,
        gpu_eff_s DOUBLE PRECISION NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_job_daily_day ON job_daily (day);

      CREATE TABLE IF NOT EXISTS job_daily_hist (
        day DATE NOT NULL,
        cluster TEXT NOT NULL,
        partition TEXT,
        qos TEXT,
        account_id INT,
        user_id INT,
        kind SMALLINT NOT NULL,
        bin SMALLINT NOT NULL,
        w DOUBLE PRECISION NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_job_daily_hist_day ON job_daily_hist (kind, day);

      CREATE TABLE IF NOT EXISTS job_daily_nodes (
        day DATE NOT NULL,
        cluster TEXT NOT NULL,
        partition TEXT,
        qos TEXT,
        node TEXT NOT NULL,
        jobs INT NOT NULL,
        preempted INT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_job_daily_nodes_day ON job_daily_nodes (day);
    `,
  },
];
