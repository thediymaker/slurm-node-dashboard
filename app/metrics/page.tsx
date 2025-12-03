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
  MetricsFilters 
} from "@/actions/metrics";
import { MetricsFilter } from "@/components/metrics/metrics-filter";
import { KPICards } from "@/components/metrics/kpi-cards";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";
import UnifiedHeader from "@/components/unified-header";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    from?: string;
    to?: string;
    clusters?: string;
    accounts?: string;
    users?: string;
    metric?: string;
    colleges?: string;
    departments?: string;
    search?: string;
  }
}

export default async function MetricsPage({ searchParams }: PageProps) {
  // Feature Flag Check
  if (process.env.NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN !== 'true') {
    redirect("/");
  }

  // Parse Filters
  const filters: MetricsFilters = {
    startDate: searchParams.from ? new Date(searchParams.from) : addDays(new Date(), -30),
    endDate: searchParams.to ? new Date(searchParams.to) : new Date(),
    clusters: searchParams.clusters ? searchParams.clusters.split(',') : [],
    accounts: searchParams.accounts ? searchParams.accounts.split(',') : [],
    users: searchParams.users ? searchParams.users.split(',') : [],
    colleges: searchParams.colleges ? searchParams.colleges.split(',') : [],
    departments: searchParams.departments ? searchParams.departments.split(',') : [],
    search: searchParams.search,
  };

  const metric = (searchParams.metric as 'coreHours' | 'jobCount') || 'coreHours';

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
    collegeTrendData
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
    getHierarchyTimeSeriesData(filters, metric, 'college')
  ]);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 bg-background min-h-screen">
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
        metric={metric}
      />
    </div>
  );
}
