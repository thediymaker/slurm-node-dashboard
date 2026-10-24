# Upgrading to 3.0

3.0 changes how the dashboard is configured and how history and metrics are collected. Most installs upgrade without changing anything. This page lists what changed, what you might need to do, and what you can now remove.

## What changed

- **Settings are read when the server starts.** Before 3.0, plugin flags, the cluster name and logo, the support URL, the metrics time zone and the hierarchy labels were baked in when the app was built. Changing one now needs a restart instead of a rebuild. Your `.env` file still works. The only build-time setting left is `NEXT_PUBLIC_BASE_PATH`.
- **Features turn on when what they need is configured.** You no longer have to set a flag for each feature. A flag set to `"false"` still turns its feature off. The admin page's **Plugins** tab now shows every feature's state and why.
- **The dashboard collects history itself.** With a database configured, it saves hourly Rewind snapshots, records each node's states and drain and down periods (new: node history), records the cluster's hourly CPU and GPU capacity (for utilization on the metrics page), and captures GPU history. These replace the cron jobs from earlier versions.
- **The metrics page has four tabs.** Overview, Explorer (any metric grouped by account, user, college, department, partition, QoS, job size, wall time, state or cluster), Efficiency and Jobs share one filter bar, and the URL holds the whole view, so links can be shared. Every table and chart exports CSV.
- **`SLURM_API_VERSION` is optional.** When it's unset, the dashboard uses the newest version your slurmrestd serves.
- **`DATABASE_URL` replaces `SLURM_JOB_METRICS_DATABASE_URL`.** The old name still works.

## What works with and without a database

| Feature | Needs | Database |
|---|---|---|
| Nodes, jobs, partitions, reservations, QoS, admin | slurmrestd | No |
| Modules | `public/modules.json` or `MODULES_FILE` | No |
| Node charts | `PROMETHEUS_URL` | No |
| GPU utilization and the GPU Analysis tab | Prometheus with DCGM metrics, `NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=true` | No |
| AI assistant | `NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=true` and a model endpoint | No |
| Rewind | Built-in snapshots, or snapshot files from the old cron script | Yes, or `data/` files |
| Node history | Built-in collection | Yes |
| GPU history (finished jobs) | GPU utilization | Yes |
| Job metrics and hierarchy | slurm-history-ingestor writing to the same database | Yes |
| Fair share | slurmrestd, `PriorityType=priority/multifactor` | No |
| Event log | `EVENT_LOG` | No |

## Upgrade steps

### Everyone

1. Update the code or image, build, and restart as usual.
2. If you set any settings only in the build environment (for example `NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=true npm run build`), set them where the server runs instead: in `.env` or the service's environment.
3. Open **Admin → Plugins** and check that the features you use are on. Each feature that's off says why.

### If you build the Docker image

Build arguments for plugin flags, `CLUSTER_NAME`, `CLUSTER_LOGO`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SUPPORT_URL` and the hierarchy labels still work: each becomes the container's default. You can now set them at runtime instead (`docker run -e`, an env file, or your Kubernetes manifest), which lets you use one image for several clusters. `NEXT_PUBLIC_BASE_PATH` is still a build argument.

### If you use job metrics, GPU history or Rewind

- **Database permissions:** on first start, the dashboard creates the tables it writes (`dashboard_schema_migrations`, `node_events`, `node_state_time`, `node_snapshots`, `cluster_capacity`, and `accounts`, `organizations`, `account_mappings` and `job_gpu_metrics` if they're missing). Its database user needs `CREATE` permission on the database for that first start. If it doesn't have it, job metrics keep working, and Rewind snapshots and node history stay off until you grant it:

  ```sql
  GRANT CREATE ON SCHEMA public TO <dashboard user>;
  ```

- **Remove the GPU capture cron job** (`curl -X POST .../api/gpu`). The dashboard now captures every minute. The endpoint still works, so leaving the cron job in place does no harm.
- **Remove the Rewind snapshot cron job.** With a database the dashboard saves snapshots itself. Rewind still reads the snapshot files in `data/`, so older history stays available. The cron script was what deleted old files, so delete them yourself once you no longer need them.
- **Run one collector per database.** If you run several dashboard instances against one database, only one of them collects at a time; the others take over if it stops.

### If you use the Modules page

The sample `public/modules.json` is no longer shipped (it's now `infra/modules.example.json`), so Modules only turns on when you provide your own file. If `git pull` stops because your local `public/modules.json` would be overwritten, move your file aside, pull, and move it back. To keep the file outside the app directory, set `MODULES_FILE`.

### If you run slurm-history-ingestor

Upgrade to the release that ships with 3.0. It saves its sync position, so a quiet cluster no longer re-scans its whole history on every pass, which could pin a CPU. In API mode it uses the newest API version slurmrestd serves when `SLURM_API_VERSION` is unset (the old default, v0.0.41, isn't served by Slurm 26.05), and it's published as a container image. The first pass after upgrading still scans from the last finished job, once.

The metrics page's CPU efficiency needs slurm-history-ingestor 1.1, which records the CPU time each job used (`total_cpu_seconds`). With an older ingestor the page works and shows "needs slurm-history-ingestor 1.1" where CPU efficiency would be; jobs ingested before the upgrade have no CPU time. In sacct mode 1.1 also records each job's peak memory, which memory efficiency uses.

## Removed

- **InfluxDB and maintenance notification flags** (`NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN`, `NEXT_PUBLIC_MAINT_NOTIFICATIONS_ENABLED`): neither did anything beyond showing a status in the admin panel.
- **`NEXT_PUBLIC_SLURM_API_VERSION`:** the admin panel now shows the version slurmrestd actually answered with.
- **`NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN`** never controlled Prometheus and is now ignored. Node charts are on whenever `PROMETHEUS_URL` is set, as before.

## New settings

| Setting | Default | |
|---|---|---|
| `DATABASE_URL` | none | PostgreSQL connection string |
| `MODULES_FILE` | `public/modules.json` | Lmod spider JSON for the Modules page |
| `ENABLE_NODE_HISTORY` | on with a database | `false` turns node history off |
| `GPU_METRICS_HISTORY` | on with a database and GPU utilization | `false` turns GPU history off |
| `NODE_HISTORY_INTERVAL_SECONDS` | `60` | `0` turns node history collection off |
| `NODE_HISTORY_RETENTION_DAYS` | `30` | `0` keeps node history forever |
| `CAPACITY_RETENTION_DAYS` | `400` | Days of hourly cluster capacity (utilization) to keep; never less than `NODE_HISTORY_RETENTION_DAYS`. `0` keeps it forever |
| `SNAPSHOT_INTERVAL_MINUTES` | `60` | `0` turns built-in Rewind snapshots off |
| `SNAPSHOT_RETENTION_DAYS` | `30` | `0` keeps snapshots forever |
| `GPU_CAPTURE_INTERVAL_SECONDS` | `60` | `0` turns built-in GPU capture off |
| `DATABASE_POOL_MAX` | `10` | Maximum database connections per dashboard process |
| `DATABASE_CONNECT_TIMEOUT_MS` | `5000` | How long to wait for a database connection before treating it as unreachable |
| `EVENT_LOG` | off | `stdout` or a file path: JSON lines of node state changes and node and cluster metrics, for Telegraf, Vector and similar |
| `EVENT_LOG_INTERVAL_SECONDS` | `60` | How often the event log writes metrics (at least 10) |
| `EVENT_LOG_METRICS` | `true` | `false` writes only node state changes |
| `ENABLE_FAIRSHARE` | on | `false` hides fair share in a user's job details |
| `FAIRSHARE_CACHE_SECONDS` | `300` | How long the slurmrestd `/shares` tree is reused |
