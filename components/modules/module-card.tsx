"use client";
import React, { memo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  ChevronDown,
  Copy,
  Check,
  Terminal,
  Info,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Version {
  versionName?: string;
  help?: string;
  full?: string;
  path?: string;
  markedDefault?: boolean;
  parent?: string[][];
}

interface ModuleCardProps {
  module: {
    package?: string;
    defaultVersionName?: string | boolean;
    versions?: Version | Version[];
  };
  index: number;
  viewMode?: 'grid' | 'list';
}

// Helper to parse module name and extract base name/version/compiler
const parseModuleName = (packageName: string) => {
  // Pattern: name-version-compiler (e.g., boost-1.83.0-gcc-12.1.0)
  const parts = packageName.split('-');
  
  // Try to detect if it's a spack-style name with compiler
  const gccIndex = parts.findIndex(p => p === 'gcc' || p === 'intel' || p === 'clang' || p === 'aocc');
  
  if (gccIndex > 0) {
    const baseName = parts.slice(0, gccIndex - 1).join('-');
    const version = parts[gccIndex - 1];
    const compiler = parts.slice(gccIndex).join('-');
    return { baseName, version, compiler };
  }
  
  // Check for versioned module (e.g., mesa/23.3.5)
  if (packageName.includes('/')) {
    const [baseName, version] = packageName.split('/');
    return { baseName, version, compiler: null };
  }
  
  return { baseName: packageName, version: null, compiler: null };
};

// Extract a cleaner description from help text
const extractDescription = (help?: string): string => {
  if (!help) return "No description available";
  
  // Remove "Name:", "Version:", "Target:" lines and get the actual description
  const lines = help.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           !trimmed.startsWith('Name') && 
           !trimmed.startsWith('Version') && 
           !trimmed.startsWith('Target');
  });
  
  return lines.join(' ').trim() || "No description available";
};

// Prerequisite modules for a version (the first set, if Lmod lists several)
const getPrereqs = (ver?: Version): string[] => ver?.parent?.[0] ?? [];

// Full command for a version, including its prerequisites so it works as pasted
const buildLoadCommand = (ver: Version | undefined, packageName: string): string => {
  if (!ver?.full) return `module load ${packageName}`;
  return ["module load", ...getPrereqs(ver), ver.full].join(" ");
};

const isDefaultVersion = (ver: Version, defaultVersionName?: string | boolean) =>
  !!ver.markedDefault ||
  (typeof defaultVersionName === "string" && ver.versionName === defaultVersionName);

// Version to feature at the top of the card: a default that needs no
// prerequisites (what a plain `module load <name>` gives), otherwise the
// package's default version, otherwise the first version in the file
const pickPrimaryVersion = (
  versions: Version[],
  defaultVersionName?: string | boolean
): Version | undefined =>
  versions.find(v => isDefaultVersion(v, defaultVersionName) && getPrereqs(v).length === 0) ??
  (typeof defaultVersionName === "string"
    ? versions.find(v => v.versionName === defaultVersionName)
    : undefined) ??
  versions.find(v => v.markedDefault) ??
  versions[0];

// Help text from the featured version, or from any version that has some
const pickHelp = (versions: Version[], primary?: Version): string | undefined =>
  primary?.help || versions.find(v => v.help)?.help;

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleCopy}
      className={`p-1.5 hover:bg-muted/80 rounded-md transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
      )}
    </motion.button>
  );
}

// Normalize the versions field, which can be a single object or a list
const toVersionList = (versions?: Version | Version[]): Version[] =>
  !versions ? [] : Array.isArray(versions) ? versions : [versions];

// Everything both views need to describe one module
const getModuleInfo = (module: ModuleCardProps["module"]) => {
  const versions = toVersionList(module.versions);
  const packageName = module.package || "Unknown Module";
  const primary = pickPrimaryVersion(versions, module.defaultVersionName);
  return {
    versions,
    packageName,
    primary,
    ...parseModuleName(packageName),
    description: extractDescription(pickHelp(versions, primary)),
    loadCommand: buildLoadCommand(primary, packageName),
    // Featured version first, then the rest in file order
    orderedVersions: primary ? [primary, ...versions.filter(v => v !== primary)] : versions,
  };
};

// ============ Module details (shared by the list view and the grid popup) ============
function ModuleDetails({ module }: { module: ModuleCardProps["module"] }) {
  const { packageName, primary, description, loadCommand, orderedVersions } = getModuleInfo(module);

  return (
    <div className="space-y-3">
      {/* Module Load Command */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
        <code className="text-sm font-mono text-foreground flex-1 truncate">
          {loadCommand}
        </code>
        <CopyButton text={loadCommand} />
      </div>

      {/* Full Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="w-3.5 h-3.5 text-primary" />
          Description
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed pl-5">
          {description}
        </p>
      </div>

      {/* Versions */}
      {orderedVersions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="w-3.5 h-3.5 text-primary" />
            Available Versions
          </div>
          <div className="space-y-1.5 pl-5">
            {orderedVersions.map((ver, idx) => {
              const isDefault = isDefaultVersion(ver, module.defaultVersionName);
              const prereqSets = ver.parent ?? [];
              return (
                <div key={idx} className="flex items-center gap-2 flex-wrap text-xs">
                  <Badge
                    variant={isDefault ? "default" : "secondary"}
                    className={`text-xs rounded-md ${
                      isDefault ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''
                    }`}
                  >
                    {ver.versionName || ver.full || 'default'}
                    {isDefault && (
                      <span className="ml-1 text-[10px] opacity-70">(default)</span>
                    )}
                  </Badge>
                  {prereqSets.length > 0 ? (
                    <>
                      <span className="text-muted-foreground">Requires</span>
                      {prereqSets.map((set, setIdx) => (
                        <React.Fragment key={setIdx}>
                          {setIdx > 0 && <span className="text-muted-foreground">or</span>}
                          {set.map(dep => (
                            <code
                              key={dep}
                              className="font-mono px-1.5 py-0.5 rounded-md border border-muted"
                            >
                              {dep}
                            </code>
                          ))}
                        </React.Fragment>
                      ))}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No prerequisites</span>
                  )}
                  {ver.full && (
                    <CopyButton text={buildLoadCommand(ver, packageName)} className="ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Module Path */}
      {primary?.path && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-muted">
          <span>Path:</span>
          <code className="font-mono truncate flex-1">{primary.path}</code>
          <CopyButton text={primary.path} />
        </div>
      )}
    </div>
  );
}

// ============ Grid Card (Compact; click to open full details) ============
function ModuleGridCard({ module, index }: Omit<ModuleCardProps, 'viewMode'>) {
  const [isOpen, setIsOpen] = useState(false);
  const { versions, primary, baseName, version, compiler, description, loadCommand } =
    getModuleInfo(module);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.015, duration: 0.2 }}
    >
      <Card
        className="bg-card border hover:border-primary/30 transition-all duration-200 h-full cursor-pointer"
        onClick={() => setIsOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-primary truncate">
              {baseName}
            </CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {version && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs px-1.5 py-0 rounded-md">
                  {version}
                </Badge>
              )}
              {compiler && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 rounded-md">
                  {compiler}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {/* Description */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>

          {/* Module Load Command */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <code className="text-xs font-mono text-foreground flex-1 truncate">
              {loadCommand}
            </code>
            <CopyButton text={loadCommand} />
          </div>

          {/* Version info */}
          {versions.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {versions.length === 1 ? '1 version' : `${versions.length} versions`}
              </span>
              {primary?.full && (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 rounded-md"
                >
                  {primary.versionName || 'default'}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kept outside the Card so clicks inside the popup don't reach the card's onClick */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-primary">{baseName}</span>
            </DialogTitle>
            <DialogDescription>
              {versions.length === 1 ? '1 version' : `${versions.length} versions`}
            </DialogDescription>
          </DialogHeader>
          <ModuleDetails module={module} />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ============ List Card (Expandable row) ============
function ModuleListCard({ module, index }: Omit<ModuleCardProps, 'viewMode'>) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { versions, baseName, version, compiler, description } = getModuleInfo(module);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
    >
      <Card 
        className={`bg-card border hover:border-primary/30 transition-all duration-200 cursor-pointer ${
          isExpanded ? 'ring-1 ring-primary/20' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <span className="text-primary truncate">{baseName}</span>
                  {version && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs shrink-0 rounded-md">
                      {version}
                    </Badge>
                  )}
                  {compiler && (
                    <Badge variant="outline" className="text-xs shrink-0 rounded-md">
                      {compiler}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {versions.length > 1 && (
                <Badge variant="secondary" className="text-xs rounded-md">
                  {versions.length} versions
                </Badge>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Separator />
              <CardContent className="p-4">
                <ModuleDetails module={module} />
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ============ Main Export ============
function ModuleCardComponent({ module, index, viewMode = 'grid' }: ModuleCardProps) {
  if (viewMode === 'grid') {
    return <ModuleGridCard module={module} index={index} />;
  }
  return <ModuleListCard module={module} index={index} />;
}

export const ModuleCard = memo(ModuleCardComponent);
export default ModuleCard;