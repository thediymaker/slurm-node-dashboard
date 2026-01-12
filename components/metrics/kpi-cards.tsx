import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Clock, Cpu, Users, Monitor, Layers } from "lucide-react"
import { DashboardStats } from "@/actions/metrics"

interface KPICardsProps {
  stats: DashboardStats
}

export function KPICards({ stats }: KPICardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalJobs.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Completed jobs in range
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Core Hours</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCoreHours.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-xs text-muted-foreground">
            CPU hours consumed
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">GPU Hours</CardTitle>
          <Monitor className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalGpuHours.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-xs text-muted-foreground">
            GPU hours consumed
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">GPU Jobs</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.gpuJobs.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Jobs using GPUs
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Unique users submitting jobs
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(stats.avgWaitTime / 60).toFixed(1)} min</div>
          <p className="text-xs text-muted-foreground">
            Average queue time
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

