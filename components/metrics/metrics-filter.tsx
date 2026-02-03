"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { DatePickerWithRange } from "./date-range-picker"
import { MultiSelect, Option } from "./multi-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Filter, Calendar, RotateCcw, Check, Search, Bookmark } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { getHierarchyLabels } from "@/lib/utils"

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
  const [searchQuery, setSearchQuery] = React.useState<string>(
    searchParams.get("search") || ""
  )

  const { level1, level2 } = getHierarchyLabels();

  // Auto-apply helper for immediate refresh (metric, date preset)
  const autoApply = React.useCallback((overrides: { metric?: string; date?: DateRange }) => {
    const params = new URLSearchParams()
    const effectiveDate = overrides.date || date
    const effectiveMetric = overrides.metric || metric

    if (effectiveDate?.from) params.set("from", effectiveDate.from.toISOString())
    if (effectiveDate?.to) params.set("to", effectiveDate.to.toISOString())
    if (selectedClusters.length) params.set("clusters", selectedClusters.join(","))
    if (selectedAccounts.length) params.set("accounts", selectedAccounts.join(","))
    if (selectedUsers.length) params.set("users", selectedUsers.join(","))
    if (selectedColleges.length) params.set("colleges", selectedColleges.join(","))
    if (selectedDepartments.length) params.set("departments", selectedDepartments.join(","))
    if (searchQuery) params.set("search", searchQuery)
    params.set("metric", effectiveMetric)

    router.push(`/metrics?${params.toString()}`)
  }, [date, metric, selectedClusters, selectedAccounts, selectedUsers, selectedColleges, selectedDepartments, searchQuery, router])

  const handleApply = () => {
    const params = new URLSearchParams()
    if (date?.from) params.set("from", date.from.toISOString())
    if (date?.to) params.set("to", date.to.toISOString())
    if (selectedClusters.length) params.set("clusters", selectedClusters.join(","))
    if (selectedAccounts.length) params.set("accounts", selectedAccounts.join(","))
    if (selectedUsers.length) params.set("users", selectedUsers.join(","))
    if (selectedColleges.length) params.set("colleges", selectedColleges.join(","))
    if (selectedDepartments.length) params.set("departments", selectedDepartments.join(","))
    if (searchQuery) params.set("search", searchQuery)
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
    setSearchQuery("")
    router.push("/metrics")
  }

  const handlePresetChange = (value: string) => {
    const now = new Date();
    let newDate: DateRange | undefined;
    switch (value) {
      case "24h":
        newDate = { from: addDays(now, -1), to: now };
        break;
      case "7d":
        newDate = { from: addDays(now, -7), to: now };
        break;
      case "30d":
        newDate = { from: addDays(now, -30), to: now };
        break;
      case "90d":
        newDate = { from: addDays(now, -90), to: now };
        break;
      case "1y":
        newDate = { from: addDays(now, -365), to: now };
        break;
    }
    if (newDate) {
      setDate(newDate);
      autoApply({ date: newDate });
    }
  };

  const handleMetricChange = (value: string) => {
    if (value) {
      setMetric(value);
      autoApply({ metric: value });
    }
  };

  // Dashboard preset views
  const handlePresetViewChange = (preset: string) => {
    const now = new Date();

    switch (preset) {
      case "executive":
        // Executive Summary: 30 days, Core Hours
        setDate({ from: addDays(now, -30), to: now });
        setMetric("coreHours");
        setSelectedClusters([]);
        setSelectedAccounts([]);
        setSelectedUsers([]);
        autoApply({
          date: { from: addDays(now, -30), to: now },
          metric: "coreHours"
        });
        break;
      case "gpu":
        // GPU Focus: 7 days
        setDate({ from: addDays(now, -7), to: now });
        setMetric("coreHours");
        autoApply({
          date: { from: addDays(now, -7), to: now },
          metric: "coreHours"
        });
        break;
      case "queue":
        // Queue Health: 24 hours
        setDate({ from: addDays(now, -1), to: now });
        setMetric("jobCount");
        autoApply({
          date: { from: addDays(now, -1), to: now },
          metric: "jobCount"
        });
        break;
      case "quarterly":
        // Quarterly Report: 90 days
        setDate({ from: addDays(now, -90), to: now });
        setMetric("coreHours");
        autoApply({
          date: { from: addDays(now, -90), to: now },
          metric: "coreHours"
        });
        break;
    }
  };

  return (
    <Card className="mb-6 shadow-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Filters</CardTitle>
              <p className="text-sm text-muted-foreground">Refine your metrics view</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users, groups, departments..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              />
            </div>

            <Select onValueChange={handlePresetViewChange}>
              <SelectTrigger className="w-[150px]">
                <Bookmark className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Presets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive">Executive Summary</SelectItem>
                <SelectItem value="gpu">GPU Focus</SelectItem>
                <SelectItem value="queue">Queue Health</SelectItem>
                <SelectItem value="quarterly">Quarterly Report</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Quick Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 3 Months</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-8 w-[1px] bg-border hidden sm:block" />

            <ToggleGroup type="single" value={metric} onValueChange={handleMetricChange} className="border rounded-md p-1 bg-background">
              <ToggleGroupItem value="coreHours" size="sm" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Core Hours</ToggleGroupItem>
              <ToggleGroupItem value="jobCount" size="sm" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Job Count</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Time & Location */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <Calendar className="w-4 h-4" />
              Time & Location
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Date Range</Label>
                <DatePickerWithRange date={date} setDate={setDate} className="w-full" />
              </div>
              <div className="space-y-1.5">
                <Label>Clusters</Label>
                <MultiSelect
                  options={clusterOptions.map(c => ({ label: c, value: c }))}
                  selected={selectedClusters}
                  onChange={setSelectedClusters}
                  placeholder="Select clusters"
                />
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <div className="w-4 h-4 rounded-full border-2 border-current" />
              Organization
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{level1}s</Label>
                <MultiSelect
                  options={collegeOptions.map(c => ({ label: c, value: c }))}
                  selected={selectedColleges}
                  onChange={setSelectedColleges}
                  placeholder={`Select ${level1.toLowerCase()}s`}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{level2}s</Label>
                <MultiSelect
                  options={departmentOptions.map(d => ({ label: d, value: d }))}
                  selected={selectedDepartments}
                  onChange={setSelectedDepartments}
                  placeholder={`Select ${level2.toLowerCase()}s`}
                />
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <div className="w-4 h-4 rounded-sm border-2 border-current" />
              Identity
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Accounts / Groups</Label>
                <MultiSelect
                  options={accountOptions.map(a => ({ label: a, value: a }))}
                  selected={selectedAccounts}
                  onChange={setSelectedAccounts}
                  placeholder="Select accounts"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Users</Label>
                <MultiSelect
                  options={userOptions.map(u => ({ label: u, value: u }))}
                  selected={selectedUsers}
                  onChange={setSelectedUsers}
                  placeholder="Select users"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 bg-muted/10 py-4">
        <Button variant="ghost" onClick={handleReset} className="gap-2 hover:bg-destructive/10 hover:text-destructive">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        <Button onClick={handleApply} className="gap-2 min-w-[140px] shadow-sm">
          <Check className="w-4 h-4" />
          Apply Filters
        </Button>
      </CardFooter>
    </Card>
  )
}
