"use client";
import React, { useState, useMemo, useCallback, useRef } from "react";
import { Check, ChevronRight, Copy, Package, Search, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { buildLoadCommand, type ModulePackage } from "./module-utils";

const PAGE_SIZE = 100;

function CopyButton({ text, label = "Copy to clipboard", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      title={label}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground/30 bg-muted text-foreground"
          : "bg-card text-foreground/80 hover:border-foreground/20 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// Lower is a better match: exact name, name prefix, name contains, then description or help
function matchScore(pkg: ModulePackage, query: string): number | null {
  const name = pkg.name.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (pkg.description.toLowerCase().includes(query)) return 3;
  if (pkg.versions.some((v) => v.label.toLowerCase().includes(query) || v.help?.toLowerCase().includes(query))) return 4;
  return null;
}

function ModuleDetail({ pkg }: { pkg: ModulePackage }) {
  const [selected, setSelected] = useState(pkg.primary);
  const version = pkg.versions[selected] ?? pkg.versions[pkg.primary];
  const loadCommand = buildLoadCommand(version);
  const [firstSet, ...otherSets] = version.prereqs;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="font-mono text-xl font-medium break-words">{pkg.name}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{pkg.description}</p>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Load it</span>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pl-3 pr-1.5">
          <code className="flex-1 min-w-0 break-words py-1 font-mono text-[13px]">
            <span className="select-none text-muted-foreground">$ </span>
            {loadCommand}
          </code>
          <CopyButton text={loadCommand} label="Copy command" />
        </div>
        {firstSet?.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Needs{" "}
            {firstSet.map((dep, i) => (
              <React.Fragment key={dep}>
                {i > 0 && " and "}
                <code className="font-mono text-foreground">{dep}</code>
              </React.Fragment>
            ))}{" "}
            loaded first, so {firstSet.length > 1 ? "they're" : "it's"} included above.
            {otherSets.length > 0 && (
              <>
                {" "}It also loads after{" "}
                {otherSets.map((set, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && " or "}
                    <code className="font-mono text-foreground">{set.join(" ")}</code>
                  </React.Fragment>
                ))}
                .
              </>
            )}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">
          {pkg.versions.length === 1 ? "1 version" : `${pkg.versions.length} versions`}
        </span>
        <div className="overflow-hidden rounded-lg border">
          {pkg.versions.map((ver, idx) => (
            <div
              key={`${ver.full}-${idx}`}
              className={cn(
                "flex items-center gap-2 border-t pr-1.5 first:border-t-0",
                idx === selected && "bg-muted/50"
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(idx)}
                aria-pressed={idx === selected}
                className="grid min-w-0 flex-1 grid-cols-[minmax(80px,auto)_minmax(0,1fr)] items-center gap-3 py-2 pl-3 text-left text-[13px]"
              >
                <span className="font-mono">{ver.label}</span>
                <span className="truncate font-mono text-xs text-muted-foreground" title={ver.prereqs.map((s) => s.join(" ")).join(" or ")}>
                  {ver.prereqs.length > 0 ? ver.prereqs.map((s) => s.join(" ")).join(" or ") : "no prerequisites"}
                </span>
              </button>
              {ver.isDefault && (
                <span className="shrink-0 rounded-md border border-emerald-500/40 px-1.5 py-px text-[11px] text-emerald-600 dark:text-emerald-400">
                  default
                </span>
              )}
              <CopyButton text={buildLoadCommand(ver)} label={`Copy load command for ${ver.label}`} />
            </div>
          ))}
        </div>
      </div>

      {(version.help || version.path) && (
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground">
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
            Module help and path
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {version.help && (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{version.help.trim()}</p>
            )}
            {version.path && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <code className="flex-1 min-w-0 break-words font-mono">{version.path}</code>
                <CopyButton text={version.path} label="Copy path" />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function ModuleBrowser({ packages }: { packages: ModulePackage[] }) {
  const [query, setQuery] = useState("");
  const [compiler, setCompiler] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  const { compilers, categories } = useMemo(
    () => ({
      compilers: [...new Set(packages.flatMap((p) => p.compilers))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
      categories: [...new Set(packages.map((p) => p.category))].sort(),
    }),
    [packages]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches: { pkg: ModulePackage; score: number }[] = [];
    for (const pkg of packages) {
      if (compiler && !pkg.compilers.includes(compiler)) continue;
      if (category && pkg.category !== category) continue;
      const score = q ? matchScore(pkg, q) : 0;
      if (score !== null) matches.push({ pkg, score });
    }
    // packages arrive sorted by name, and sort is stable
    return matches.sort((a, b) => a.score - b.score).map((m) => m.pkg);
  }, [packages, query, compiler, category]);

  const selected = filtered.find((p) => p.name === selectedName) ?? filtered[0];
  const hasFilters = !!(query || compiler || category);

  const resetPaging = () => setVisible(PAGE_SIZE);

  const clearFilters = () => {
    setQuery("");
    setCompiler(null);
    setCategory(null);
    resetPaging();
  };

  const selectPackage = (name: string) => {
    setSelectedName(name);
    // When the panes are stacked, bring the details into view
    const list = listRef.current;
    const detail = detailRef.current;
    if (list && detail && detail.offsetTop > list.offsetTop + 8) {
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section ref={listRef} className="flex min-w-0 flex-[999_1_560px] flex-col gap-3" aria-label="Module list">
        {/* Search */}
        <div className="flex h-11 items-center gap-2.5 rounded-lg border bg-card px-3.5 focus-within:border-ring/50">
          <Search className="h-[17px] w-[17px] shrink-0 text-muted-foreground" />
          <label htmlFor="module-search" className="sr-only">
            Search modules
          </label>
          <input
            id="module-search"
            type="search"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="Search modules by name or description"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPaging();
            }}
            className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-muted-foreground focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                resetPaging();
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </button>
          )}
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {filtered.length === packages.length
              ? `${packages.length.toLocaleString()} packages`
              : `${filtered.length.toLocaleString()} of ${packages.length.toLocaleString()}`}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {compilers.length > 0 && (
            <>
              <span className="mr-1 text-xs text-muted-foreground">Compiler</span>
              {compilers.map((c) => (
                <FilterChip
                  key={c}
                  active={compiler === c}
                  onClick={() => {
                    setCompiler(compiler === c ? null : c);
                    resetPaging();
                  }}
                >
                  {c}
                </FilterChip>
              ))}
              <span className="mx-1.5 h-[18px] w-px bg-border" />
            </>
          )}
          <span className="mr-1 text-xs text-muted-foreground">Type</span>
          {categories.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => {
                setCategory(category === c ? null : c);
                resetPaging();
              }}
            >
              {c}
            </FilterChip>
          ))}
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="ml-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
              Clear all
            </button>
          )}
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No modules found matching your criteria.</p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {filtered.slice(0, visible).map((pkg) => {
              const isSelected = pkg === selected;
              const shown = pkg.compilers.slice(0, 2);
              return (
                <button
                  key={pkg.name}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectPackage(pkg.name)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t px-3.5 py-3 text-left transition-colors first:border-t-0",
                    isSelected ? "bg-muted/60 shadow-[inset_2px_0_0_hsl(var(--foreground))]" : "hover:bg-muted/30"
                  )}
                >
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className="truncate font-mono text-sm font-medium">{pkg.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{pkg.versions[0].label}</span>
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {pkg.versions.length === 1 ? "1 version" : `${pkg.versions.length} versions`}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{pkg.description}</span>
                  <span className="flex justify-end gap-1">
                    {shown.map((c) => (
                      <span key={c} className="whitespace-nowrap rounded-[5px] border px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                        {c}
                      </span>
                    ))}
                    {pkg.compilers.length > shown.length && (
                      <span className="text-[11px] text-muted-foreground">+{pkg.compilers.length - shown.length}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {filtered.length > visible && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            Showing {visible.toLocaleString()} of {filtered.length.toLocaleString()}
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-md border bg-card px-3 py-1.5 text-foreground hover:bg-muted"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
            </button>
          </div>
        )}
      </section>

      <aside
        ref={detailRef}
        aria-label={selected ? selected.name : "Module details"}
        className="min-w-0 flex-[1_1_420px] scroll-mt-4 rounded-xl border bg-card p-[18px] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
      >
        {selected ? (
          // Keyed so the version picked for one package doesn't carry over to the next
          <ModuleDetail key={selected.name} pkg={selected} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Select a module to see how to load it.</p>
        )}
      </aside>
    </div>
  );
}

export default ModuleBrowser;
