"use client";
import React, { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Search, Package, Filter, X, Grid3X3, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ModuleCard from "./module-card";

type Version = {
  versionName?: string;
  help?: string;
  full?: string;
};

type Module = {
  package?: string;
  defaultVersionName?: string | boolean;
  versions?: Version | Version[];
};

interface ModuleGridProps {
  modules: Module[];
}

// Extract compiler from package name
const extractCompiler = (packageName: string): string | null => {
  const compilers = ['gcc', 'intel', 'clang', 'aocc', 'nvhpc', 'pgi'];
  for (const compiler of compilers) {
    if (packageName.toLowerCase().includes(`-${compiler}-`)) {
      return compiler;
    }
  }
  return null;
};

// Extract category from module name (first word before dash or version)
const extractCategory = (packageName: string): string => {
  // Common category prefixes
  const categories: Record<string, string[]> = {
    'Python': ['python', 'py-', 'pip'],
    'Perl': ['perl-'],
    'R': ['r-'],
    'Biology': ['bio', 'blast', 'samtools', 'bcftools', 'bedtools', 'bowtie', 'bwa', 'gatk', 'hmmer'],
    'Chemistry': ['chem', 'amber', 'gromacs', 'namd', 'lammps', 'gaussian', 'orca'],
    'Math': ['blas', 'lapack', 'fftw', 'scalapack', 'petsc'],
    'Compiler': ['gcc', 'intel', 'clang', 'llvm', 'cuda', 'nvhpc'],
    'MPI': ['openmpi', 'mpich', 'mvapich', 'impi'],
    'Libraries': ['boost', 'hdf5', 'netcdf', 'zlib', 'lib'],
    'Tools': ['cmake', 'autoconf', 'automake', 'git', 'vim', 'emacs'],
  };

  const lowerName = packageName.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => lowerName.startsWith(kw) || lowerName.includes(kw))) {
      return category;
    }
  }
  return 'Other';
};

export function ModuleGrid({ modules }: ModuleGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(20);
  const [selectedCompiler, setSelectedCompiler] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Get unique compilers and categories for filters
  const { compilers, categories } = useMemo(() => {
    const compilerSet = new Set<string>();
    const categorySet = new Set<string>();

    modules.forEach(mod => {
      const packageName = mod.package || "";
      const compiler = extractCompiler(packageName);
      if (compiler) compilerSet.add(compiler);
      categorySet.add(extractCategory(packageName));
    });

    return {
      compilers: Array.from(compilerSet).sort(),
      categories: Array.from(categorySet).sort(),
    };
  }, [modules]);

  // Filter modules
  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      if (!mod) return false;
      const packageName = mod.package || "";
      
      // Search term filter
      const matchesSearch = searchTerm === "" || 
        packageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(mod.versions) 
          ? mod.versions.some(v => v.help?.toLowerCase().includes(searchTerm.toLowerCase()))
          : mod.versions?.help?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Compiler filter
      const matchesCompiler = !selectedCompiler || 
        packageName.toLowerCase().includes(`-${selectedCompiler}-`);

      // Category filter
      const matchesCategory = !selectedCategory || 
        extractCategory(packageName) === selectedCategory;

      return matchesSearch && matchesCompiler && matchesCategory;
    });
  }, [modules, searchTerm, selectedCompiler, selectedCategory]);

  // Pagination
  const pageCount = Math.ceil(filteredModules.length / resultsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * resultsPerPage;
    return filteredModules.slice(start, start + resultsPerPage);
  }, [filteredModules, currentPage, resultsPerPage]);

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedCompiler(null);
    setSelectedCategory(null);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = searchTerm || selectedCompiler || selectedCategory;

  // Pagination component
  const renderPagination = () => {
    if (pageCount <= 1) return null;

    const maxPagesToShow = 7;
    const pages: (number | 'ellipsis')[] = [];

    if (pageCount <= maxPagesToShow) {
      for (let i = 1; i <= pageCount; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(pageCount - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < pageCount - 2) pages.push('ellipsis');
      pages.push(pageCount);
    }

    return (
      <Pagination className="mt-6">
        <PaginationContent>
          {pages.map((page, idx) => (
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={page === currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          ))}
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Available Modules</h2>
            <p className="text-sm text-muted-foreground">
              {filteredModules.length.toLocaleString()} of {modules.length.toLocaleString()} modules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="bg-muted/30 border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search modules by name or description..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Category Filter */}
            <Select
              value={selectedCategory || "all"}
              onValueChange={(v) => {
                setSelectedCategory(v === "all" ? null : v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[160px] bg-background">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Compiler Filter */}
            {compilers.length > 0 && (
              <Select
                value={selectedCompiler || "all"}
                onValueChange={(v) => {
                  setSelectedCompiler(v === "all" ? null : v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Compiler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Compilers</SelectItem>
                  {compilers.map((comp) => (
                    <SelectItem key={comp} value={comp}>{comp.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Results Per Page */}
            <Select
              value={String(resultsPerPage)}
              onValueChange={(v) => {
                setResultsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-2 mt-3 pt-3 border-t border-muted overflow-hidden"
              >
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="text-xs rounded-md">
                    Search: "{searchTerm}"
                    <button onClick={() => setSearchTerm("")} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedCategory && (
                  <Badge variant="secondary" className="text-xs rounded-md">
                    {selectedCategory}
                    <button onClick={() => setSelectedCategory(null)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedCompiler && (
                  <Badge variant="secondary" className="text-xs rounded-md">
                    {selectedCompiler.toUpperCase()}
                    <button onClick={() => setSelectedCompiler(null)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:underline ml-auto"
                >
                  Clear all
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Module Grid/List */}
      {currentItems.length === 0 ? (
        <div className="text-center p-12 rounded-xl border border-dashed border-muted-foreground/30">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No modules found matching your criteria.</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "space-y-3"
        }>
          {currentItems.map((mod, idx) => (
            <ModuleCard 
              key={mod.package || idx} 
              module={mod} 
              index={idx}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {renderPagination()}

      {/* Footer Stats */}
      <div className="text-center text-sm text-muted-foreground pb-4">
        Showing {(currentPage - 1) * resultsPerPage + 1} - {Math.min(currentPage * resultsPerPage, filteredModules.length)} of {filteredModules.length} modules
      </div>
    </div>
  );
}

export default ModuleGrid;
