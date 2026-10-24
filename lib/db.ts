import { Pool } from "pg";
import { getDatabaseUrl, readEnv } from "@/lib/config";
import { MIGRATIONS } from "@/lib/db-migrations";

export type DbPool = InstanceType<typeof Pool>;

// One pool per server process. Kept on globalThis so dev-mode reloads don't
// open a new pool each time.
const globalForDb = globalThis as unknown as {
  slurmdashPool?: DbPool;
  slurmdashSchema?: Promise<SchemaStatus>;
};

export function getDb(): DbPool | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!globalForDb.slurmdashPool) {
    const pool = new Pool({
      connectionString: url,
      max: Number(readEnv("DATABASE_POOL_MAX")) || 10,
      idleTimeoutMillis: 30000,
      // Every page checks the database's status, so an unreachable host must
      // fail fast instead of hanging requests
      connectionTimeoutMillis: Number(readEnv("DATABASE_CONNECT_TIMEOUT_MS")) || 5000,
    });
    // An idle client losing its connection emits 'error' on the pool, which
    // would otherwise crash the process
    pool.on("error", (err: Error) => console.error("[db] idle client error:", err.message));
    globalForDb.slurmdashPool = pool;
  }
  return globalForDb.slurmdashPool;
}

export type SchemaStatus =
  | { state: "disabled" }
  | { state: "ready"; applied: string[] }
  | { state: "failed"; error: string };

// Arbitrary constant shared by every dashboard process using this database,
// so only one of them migrates at a time
const MIGRATION_LOCK_KEY = 815_204_001;

async function migrate(pool: DbPool): Promise<SchemaStatus> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS dashboard_schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      const { rows } = await client.query("SELECT version FROM dashboard_schema_migrations");
      const done = new Set(rows.map((r: { version: string }) => r.version));
      const applied: string[] = [];

      for (const migration of MIGRATIONS) {
        if (done.has(migration.version)) continue;
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query("INSERT INTO dashboard_schema_migrations (version) VALUES ($1)", [
            migration.version,
          ]);
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`${migration.version}: ${(err as Error).message}`);
        }
        applied.push(migration.version);
        console.log(`[db] applied migration ${migration.version}`);
      }
      return { state: "ready", applied };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

// Bring the dashboard's own tables up to date, once per process. A failure
// (for example a database user without CREATE permission) only disables the
// features that need those tables; reading tables the ingestor manages still
// works.
export function ensureSchema(): Promise<SchemaStatus> {
  const pool = getDb();
  if (!pool) return Promise.resolve({ state: "disabled" });

  if (!globalForDb.slurmdashSchema) {
    globalForDb.slurmdashSchema = migrate(pool).catch((err: Error) => {
      console.error(`[db] migrations failed, database-backed features that need them are off: ${err.message}`);
      // Retry on a later call instead of caching the failure forever
      setTimeout(() => {
        globalForDb.slurmdashSchema = undefined;
      }, 60_000).unref();
      return { state: "failed", error: err.message } as SchemaStatus;
    });
  }
  return globalForDb.slurmdashSchema;
}
