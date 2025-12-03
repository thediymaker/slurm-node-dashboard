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
import { TimeSeriesChart } from "@/components/metrics/time-series-chart";
import { UsagePieChart } from "@/components/metrics/usage-pie-chart";
import { JobStateChart } from "@/components/metrics/job-state-chart";
import { TopUsersChart } from "@/components/metrics/top-users-chart";
import { WaitTimeChart } from "@/components/metrics/wait-time-chart";
import { PartitionChart } from "@/components/metrics/partition-chart";
import { JobDurationChart } from "@/components/metrics/job-duration-chart";
import { HierarchyChart } from "@/components/metrics/hierarchy-chart";
import { HierarchyDistributionChart } from "@/components/metrics/hierarchy-distribution-chart";
import { HierarchyTrendChart } from "@/components/metrics/hierarchy-trend-chart";
import { MetricsFilter } from "@/components/metrics/metrics-filter";
import { KPICards } from "@/components/metrics/kpi-cards";
import BaseHeader from "@/components/base-header";
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
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Job Metrics Dashboard</h2>
          <p className="text-muted-foreground">
            Historical analysis of cluster usage, efficiency, and user activity.
          </p>
        </div>
        <BaseHeader />
      </div>

      <MetricsFilter 
        clusterOptions={filterOptions.clusters}
        accountOptions={filterOptions.accounts}
        userOptions={filterOptions.users}
        collegeOptions={filterOptions.colleges}
        departmentOptions={filterOptions.departments}
      />

      <KPICards stats={stats} />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <TimeSeriesChart data={timeSeriesData} metric={metric} />
        </div>
        <div className="col-span-3">
          <UsagePieChart data={groupData} metric={metric} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-3">
          <HierarchyDistributionChart data={collegeData} metric={metric} level="college" />
        </div>
        <div className="col-span-4">
          <HierarchyChart data={deptData} metric={metric} level="department" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-7">
          <HierarchyTrendChart 
            data={collegeTrendData.data} 
            entities={collegeTrendData.entities} 
            metric={metric} 
            level="college" 
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-3">
          <JobStateChart data={jobStateData} />
        </div>
        <div className="col-span-4">
          <WaitTimeChart data={waitTimeData} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-3">
          <TopUsersChart data={topUsersData} metric={metric} />
        </div>
        <div className="col-span-4">
          <PartitionChart data={partitionData} metric={metric} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-7">
          <JobDurationChart data={durationData} />
        </div>
      </div>
    </div>
  );
}
