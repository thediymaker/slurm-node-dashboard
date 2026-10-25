import { redirect } from "next/navigation";
import { getFilterOptions } from "@/actions/metrics";
import { MetricsShell } from "@/components/metrics/metrics-shell";
import { MetricsNavProvider } from "@/components/metrics/metrics-nav";
import { OverviewTab } from "@/components/metrics/overview-tab";
import { ExplorerTab } from "@/components/metrics/explorer-tab";
import { EfficiencyTab } from "@/components/metrics/efficiency-tab";
import { JobsTab } from "@/components/metrics/jobs-tab";
import Footer from "@/components/footer/footer";
import { getPublicConfig } from "@/lib/config";
import { getDatabaseStatus, getFeatures } from "@/lib/features";
import { getMetricsDb } from "@/lib/metrics-db";
import { loadMetricsPage } from "@/lib/metrics/load";
import { parseMetricsParams } from "@/lib/metrics/params";
import { addDays, todayIn } from "@/lib/metrics/sql";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MetricsPage({ searchParams }: PageProps) {
  const [features, db] = await Promise.all([getFeatures(), getDatabaseStatus()]);
  const pool = getMetricsDb();
  if (!features.jobMetrics.enabled || !pool) {
    redirect("/");
  }
  const { clusterName, clusterLogo, metricsTimeZone } = getPublicConfig();

  const params = parseMetricsParams(await searchParams);
  const options = await getFilterOptions();
  // Without a mapping the hierarchy filters can't match anything
  if (!options.hierarchy) {
    params.filters.colleges = [];
    params.filters.departments = [];
  }
  const totalCpu = db.columns.totalCpuSeconds;
  const page = await loadMetricsPage(pool, params, {
    timeZone: metricsTimeZone,
    totalCpu,
    gpuHistory: features.gpuHistory.enabled,
    capacity: db.tables.clusterCapacity,
    hierarchy: options.hierarchy,
  });

  const { data } = page;
  // Ingestion normally trails by minutes; say so when the range runs a day or
  // more past the newest job (a backfill in progress, or a stopped ingestor)
  const through = page.historyThrough ? todayIn(metricsTimeZone, new Date(page.historyThrough)) : null;
  const notice =
    through && through < addDays(page.range.toDate, -1)
      ? `Job history runs through ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
          new Date(`${through}T00:00:00Z`)
        )}: jobs that ended after that haven't been written by the history ingestor yet, so this range is incomplete.`
      : undefined;
  return (
    <div className="mb-5">
      <div className="mx-auto max-w-[1600px] px-4 pb-2">
        <div className="pb-8">
          <MetricsNavProvider
            params={params}
            period={page.period}
            fromDate={page.range.fromDate}
            toDate={page.range.toDate}
            hierarchy={options.hierarchy}
          >
            <MetricsShell options={options} notice={notice}>
              {data.tab === "overview" && <OverviewTab data={data.overview} />}
              {data.tab === "explorer" && <ExplorerTab result={data.explorer} />}
              {data.tab === "efficiency" && <EfficiencyTab data={data.efficiency} totalCpu={totalCpu} />}
              {data.tab === "jobs" && <JobsTab data={data.jobs} totalCpu={totalCpu} />}
            </MetricsShell>
          </MetricsNavProvider>
        </div>
        <Footer cluster={clusterName} logo={clusterLogo} />
      </div>
    </div>
  );
}
