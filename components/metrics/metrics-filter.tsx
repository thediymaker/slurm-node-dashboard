"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { DatePickerWithRange } from "./date-range-picker"
import { MultiSelect, Option } from "./multi-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Filter, Calendar } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface MetricsFilterProps {
  clusterOptions: string[]
  accountOptions: string[]
  userOptions: string[]
  collegeOptions: string[]
  departmentOptions: string[]
}

export function MetricsFilter({
  clusterOptions,
  accountOptions,
  userOptions,
  collegeOptions,
  departmentOptions,
}: MetricsFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: searchParams.get("from") ? new Date(searchParams.get("from")!) : addDays(new Date(), -30),
    to: searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date(),
  })

  const [selectedClusters, setSelectedClusters] = React.useState<string[]>(
    searchParams.get("clusters")?.split(",") || []
  )
  const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>(
    searchParams.get("accounts")?.split(",") || []
  )
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>(
    searchParams.get("users")?.split(",") || []
  )
  const [selectedColleges, setSelectedColleges] = React.useState<string[]>(
    searchParams.get("colleges")?.split(",") || []
  )
  const [selectedDepartments, setSelectedDepartments] = React.useState<string[]>(
    searchParams.get("departments")?.split(",") || []
  )
  const [metric, setMetric] = React.useState<string>(
    searchParams.get("metric") || "coreHours"
  )

  const handleApply = () => {
    const params = new URLSearchParams()
    if (date?.from) params.set("from", date.from.toISOString())
    if (date?.to) params.set("to", date.to.toISOString())
    if (selectedClusters.length) params.set("clusters", selectedClusters.join(","))
    if (selectedAccounts.length) params.set("accounts", selectedAccounts.join(","))
    if (selectedUsers.length) params.set("users", selectedUsers.join(","))
    if (selectedColleges.length) params.set("colleges", selectedColleges.join(","))
    if (selectedDepartments.length) params.set("departments", selectedDepartments.join(","))
    params.set("metric", metric)

    router.push(`/metrics?${params.toString()}`)
  }

  const handleReset = () => {
    setDate({ from: addDays(new Date(), -30), to: new Date() })
    setSelectedClusters([])
    setSelectedAccounts([])
    setSelectedUsers([])
    setSelectedColleges([])
    setSelectedDepartments([])
    setMetric("coreHours")
    router.push("/metrics")
  }

  const handlePresetChange = (value: string) => {
    const now = new Date();
    switch (value) {
      case "24h":
        setDate({ from: addDays(now, -1), to: now });
        break;
      case "7d":
        setDate({ from: addDays(now, -7), to: now });
        break;
      case "30d":
        setDate({ from: addDays(now, -30), to: now });
        break;
      case "90d":
        setDate({ from: addDays(now, -90), to: now });
        break;
      case "1y":
        setDate({ from: addDays(now, -365), to: now });
        break;
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Filter className="w-5 h-5" />
            Filters
          </div>
          <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v)}>
            <ToggleGroupItem value="coreHours">Core Hours</ToggleGroupItem>
            <ToggleGroupItem value="jobCount">Job Count</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <DatePickerWithRange date={date} setDate={setDate} className="w-full" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Clusters</label>
            <MultiSelect
              options={clusterOptions.map(c => ({ label: c, value: c }))}
              selected={selectedClusters}
              onChange={setSelectedClusters}
              placeholder="Select clusters"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Colleges</label>
            <MultiSelect
              options={collegeOptions.map(c => ({ label: c, value: c }))}
              selected={selectedColleges}
              onChange={setSelectedColleges}
              placeholder="Select colleges"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Departments</label>
            <MultiSelect
              options={departmentOptions.map(d => ({ label: d, value: d }))}
              selected={selectedDepartments}
              onChange={setSelectedDepartments}
              placeholder="Select departments"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Accounts / Groups</label>
            <MultiSelect
              options={accountOptions.map(a => ({ label: a, value: a }))}
              selected={selectedAccounts}
              onChange={setSelectedAccounts}
              placeholder="Select accounts"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Users</label>
            <MultiSelect
              options={userOptions.map(u => ({ label: u, value: u }))}
              selected={selectedUsers}
              onChange={setSelectedUsers}
              placeholder="Select users"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <Select onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Date Preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 3 Months</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleReset}>Reset</Button>
            <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
