import {
  getTimeSeriesData,
  getGroupData,
  getFilterOptions,
  getDashboardStats,
  getJobStateDistribution,
  getTopUsers,
  getWaitTimeData,
  getPartitionUsage,
  getJobDurationDistribution,
  getHierarchyUsage,
  getHierarchyTimeSeriesData,
  getGpuTimeSeriesData,
  getGpuByPartition,
  getGpuTopUsers,
  getGpuByHierarchy,
  getGpuHeatmapData,
  getGpuScatterData,
  MetricsFilters
} from "@/actions/metrics";
import { MetricsFilter } from "@/components/metrics/metrics-filter";
import { KPICards } from "@/components/metrics/kpi-cards";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";
import UnifiedHeader from "@/components/unified-header";
import Footer from "@/components/footer/footer";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { env } from "process";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    clusters?: string;
    accounts?: string;
    users?: string;
    metric?: string;
    colleges?: string;
    departments?: string;
    search?: string;
  }>;
}

export default async function MetricsPage({ searchParams }: PageProps) {
  // Await searchParams (required in Next.js 15+)
  const resolvedSearchParams = await searchParams;

  // Feature Flag Check
  if (process.env.NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN !== 'true') {
    redirect("/");
  }

  // Parse Filters
  const filters: MetricsFilters = {
    startDate: resolvedSearchParams.from ? new Date(resolvedSearchParams.from) : addDays(new Date(), -30),
    endDate: resolvedSearchParams.to ? new Date(resolvedSearchParams.to) : new Date(),
    clusters: resolvedSearchParams.clusters ? resolvedSearchParams.clusters.split(',') : [],
    accounts: resolvedSearchParams.accounts ? resolvedSearchParams.accounts.split(',') : [],
    users: resolvedSearchParams.users ? resolvedSearchParams.users.split(',') : [],
    colleges: resolvedSearchParams.colleges ? resolvedSearchParams.colleges.split(',') : [],
    departments: resolvedSearchParams.departments ? resolvedSearchParams.departments.split(',') : [],
    search: resolvedSearchParams.search,
  };

  const metric = (resolvedSearchParams.metric as 'coreHours' | 'jobCount') || 'coreHours';

  // Fetch Data in Parallel
  const [
    timeSeriesData,
    groupData,
    filterOptions,
    stats,
    jobStateData,
    topUsersData,
    waitTimeData,
    partitionData,
    durationData,
    collegeData,
    deptData,
    collegeTrendData,
    gpuTimeSeriesData,
    gpuPartitionData,
    gpuTopUsersData,
    gpuCollegeData,
    gpuDeptData,
    gpuHeatmapData,
    gpuScatterData
  ] = await Promise.all([
    getTimeSeriesData(filters, metric),
    getGroupData(filters, metric),
    getFilterOptions(),
    getDashboardStats(filters),
    getJobStateDistribution(filters),
    getTopUsers(filters, metric),
    getWaitTimeData(filters),
    getPartitionUsage(filters, metric),
    getJobDurationDistribution(filters),
    getHierarchyUsage(filters, metric, 'college'),
    getHierarchyUsage(filters, metric, 'department'),
    getHierarchyTimeSeriesData(filters, metric, 'college'),
    getGpuTimeSeriesData(filters),
    getGpuByPartition(filters),
    getGpuTopUsers(filters),
    getGpuByHierarchy(filters, 'college'),
    getGpuByHierarchy(filters, 'department'),
    getGpuHeatmapData(filters),
    getGpuScatterData(filters)
  ]);

  return (
    <div className="mb-5">
      <div className="flex-1 space-y-4 p-2 ml-2 mx-auto bg-background min-h-screen">
        <UnifiedHeader
          title="Job Metrics Dashboard"
          description="Historical analysis of cluster usage, efficiency, and user activity."
        />

        <MetricsFilter
          clusterOptions={filterOptions.clusters}
          accountOptions={filterOptions.accounts}
          userOptions={filterOptions.users}
          collegeOptions={filterOptions.colleges}
          departmentOptions={filterOptions.departments}
        />

        <KPICards stats={stats} />

        <MetricsDashboard
          timeSeriesData={timeSeriesData}
          groupData={groupData}
          collegeData={collegeData}
          deptData={deptData}
          collegeTrendData={collegeTrendData}
          jobStateData={jobStateData}
          waitTimeData={waitTimeData}
          topUsersData={topUsersData}
          partitionData={partitionData}
          durationData={durationData}
          gpuTimeSeriesData={gpuTimeSeriesData}
          gpuPartitionData={gpuPartitionData}
          gpuTopUsersData={gpuTopUsersData}
          gpuCollegeData={gpuCollegeData}
          gpuDeptData={gpuDeptData}
          gpuHeatmapData={gpuHeatmapData}
          gpuScatterData={gpuScatterData}
          metric={metric}
        />
      </div>
      <Footer cluster={env.CLUSTER_NAME} logo={env.CLUSTER_LOGO} />
    </div>
  );
}

