"use client"

import * as React from "react"
import { DateRange } from "react-day-picker"
import { Calendar as CalendarIcon, Check, ChevronDown, Link2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useHierarchyLabels } from "@/components/runtime-config"
import { cn } from "@/lib/utils"
import { RANGE_PRESETS, type ListFilter, type MetricsFilters } from "@/lib/metrics/params"
import { useMetricsNav } from "@/components/metrics/metrics-nav"

// The filter bar every metrics tab shares: date range, then one chip per
// dimension. A chip's changes apply when its menu closes.

export interface FilterOptions {
  clusters: string[]
  colleges: string[]
  departments: string[]
  accounts: string[]
  users: string[]
  partitions: string[]
  qos: string[]
}

const chip =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-card text-[13px] text-foreground/90 hover:border-foreground/30 hover:bg-muted/40 transition-colors"

function shortDate(date: string, withYear = false) {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  })
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fromDateString(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function DateChip() {
  const { params, fromDate, toDate, navigate } = useMetricsNav()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DateRange | undefined>()
  const preset = RANGE_PRESETS.find((p) => p.value === params.filters.range)
  const sameYear = fromDate.slice(0, 4) === toDate.slice(0, 4)

  const apply = (filters: Partial<MetricsFilters>) => {
    setOpen(false)
    navigate((p) => ({ ...p, jobs: { ...p.jobs, page: 1 }, filters: { ...p.filters, ...filters } }))
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft({ from: fromDateString(fromDate), to: fromDateString(toDate) })
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={chip}>
          <CalendarIcon className="h-3.5 w-3.5" />
          {preset ? preset.label : "Custom range"}
          <span className="text-muted-foreground">
            {shortDate(fromDate, !sameYear)} – {shortDate(toDate, !sameYear)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-2 sm:border-r border-b sm:border-b-0 flex-wrap">
            {RANGE_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={params.filters.range === p.value ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => apply({ range: p.value, fromDate: undefined, toDate: undefined })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar mode="range" defaultMonth={draft?.from} selected={draft} onSelect={setDraft} numberOfMonths={2} />
            <div className="flex justify-end gap-2 px-3 pb-3">
              <Button
                size="sm"
                disabled={!draft?.from}
                onClick={() =>
                  draft?.from &&
                  apply({ range: "custom", fromDate: toDateString(draft.from), toDate: toDateString(draft.to ?? draft.from) })
                }
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FilterChip({ name, filter, options }: { name: string; filter: ListFilter; options: string[] }) {
  const { params, navigate } = useMetricsNav()
  const selected = params.filters[filter]
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<string[]>(selected)

  const commit = (values: string[]) => {
    const same = values.length === selected.length && values.every((v) => selected.includes(v))
    if (!same) navigate((p) => ({ ...p, jobs: { ...p.jobs, page: 1 }, filters: { ...p.filters, [filter]: values } }))
  }

  // Values in the URL that aren't in the option list still show and can be removed
  const all = [...selected.filter((s) => !options.includes(s)), ...options]
  const label =
    selected.length === 0 ? name : selected.length === 1 ? `${name}: ${selected[0]}` : `${name}: ${selected.length} selected`

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(selected)
        else commit(draft)
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={cn(chip, selected.length > 0 && "border-foreground/40 bg-muted/50")}>
          <span className="max-w-[14rem] truncate">{label}</span>
          {selected.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${name}`}
              className="rounded-sm text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                commit([])
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  commit([])
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${name.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {all.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => setDraft((d) => (d.includes(option) ? d.filter((v) => v !== option) : [...d, option]))}
                >
                  <Check className={cn("mr-2 h-4 w-4", draft.includes(option) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {draft.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setDraft([])}>
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function CopyLinkButton() {
  const { params, linkFor } = useMetricsNav()
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      className={chip}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(linkFor(params))
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard blocked (e.g. plain http): fall back to the address bar
          window.prompt("Copy this link", linkFor(params))
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  )
}

export function MetricsFilter({ options, children }: { options: FilterOptions; children?: React.ReactNode }) {
  const { hierarchy } = useMetricsNav()
  const { level1, level2 } = useHierarchyLabels()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateChip />
      <FilterChip name="Cluster" filter="clusters" options={options.clusters} />
      {hierarchy && <FilterChip name={level1} filter="colleges" options={options.colleges} />}
      {hierarchy && <FilterChip name={level2} filter="departments" options={options.departments} />}
      <FilterChip name="Account" filter="accounts" options={options.accounts} />
      <FilterChip name="User" filter="users" options={options.users} />
      <FilterChip name="Partition" filter="partitions" options={options.partitions} />
      <FilterChip name="QoS" filter="qos" options={options.qos} />
      <div className="flex-1" />
      {children}
      <CopyLinkButton />
    </div>
  )
}
