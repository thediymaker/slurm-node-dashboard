// Turns Lmod spider output into one entry per package for the Modules page.
// Spack-style installs list each build as its own package
// (boost-1.83.0-gcc-12.1.0); those are grouped under their base name so a
// package shows all its versions and the compilers they were built with.

export interface RawModuleVersion {
  versionName?: string;
  help?: string;
  full?: string;
  path?: string;
  markedDefault?: boolean;
  // Sets of modules that have to be loaded first; any one set works
  parent?: string[][];
}

export interface RawModule {
  package?: string;
  defaultVersionName?: string | boolean;
  description?: string;
  versions?: RawModuleVersion | RawModuleVersion[];
}

export interface PackageVersion {
  label: string;
  // What `module load` takes
  full: string;
  prereqs: string[][];
  compilers: string[];
  isDefault: boolean;
  help?: string;
  path?: string;
}

export interface ModulePackage {
  name: string;
  description: string;
  category: string;
  compilers: string[];
  // Newest first
  versions: PackageVersion[];
  // Index of the version to feature: what a plain `module load <name>` gives
  primary: number;
}

const COMPILERS = ["gcc", "intel", "oneapi", "clang", "llvm", "aocc", "nvhpc", "pgi"];

// name-version-compiler-compilerversion, name/version, or a bare name
export const parseModuleName = (packageName: string) => {
  const parts = packageName.split("-");
  // Last compiler token with a name and version before it, so a compiler
  // built with another compiler (gcc-12.1.0-gcc-11.2.0) still parses
  for (let i = parts.length - 2; i >= 2; i--) {
    if (COMPILERS.includes(parts[i])) {
      return {
        baseName: parts.slice(0, i - 1).join("-"),
        version: parts[i - 1],
        compiler: parts.slice(i).join("-"),
      };
    }
  }

  if (packageName.includes("/")) {
    const [baseName, ...rest] = packageName.split("/");
    return { baseName, version: rest.join("/"), compiler: null };
  }

  return { baseName: packageName, version: null, compiler: null };
};

// gcc-12.1.0 or gcc/12.1.0 -> gcc 12.1.0
const compilerLabel = (value: string): string | null => {
  const match = value.match(/^([a-z]+)[-/](.+)$/i);
  if (!match || !COMPILERS.includes(match[1].toLowerCase())) return null;
  return `${match[1].toLowerCase()} ${match[2]}`;
};

// The help text without its Name/Version/Target lines
export const extractDescription = (help?: string): string => {
  if (!help) return "No description available";

  const lines = help.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("Name") && !trimmed.startsWith("Version") && !trimmed.startsWith("Target");
  });

  return lines.join(" ").replace(/\s+/g, " ").trim() || "No description available";
};

// Full command for a version, prerequisites first so it works as pasted.
// Lmod can list several prerequisite sets; the first one is used.
export const buildLoadCommand = (version: PackageVersion): string =>
  ["module load", ...(version.prereqs[0] ?? []), version.full].join(" ");

const compareVersions = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

// Category from the package name, for the type filter
export const extractCategory = (packageName: string): string => {
  const categories: Record<string, string[]> = {
    Python: ["python", "py-", "pip"],
    Perl: ["perl-"],
    R: ["r-"],
    Biology: ["bio", "blast", "samtools", "bcftools", "bedtools", "bowtie", "bwa", "gatk", "hmmer"],
    Chemistry: ["chem", "amber", "gromacs", "namd", "lammps", "gaussian", "orca"],
    Math: ["blas", "lapack", "fftw", "scalapack", "petsc"],
    Compiler: ["gcc", "intel", "clang", "llvm", "cuda", "nvhpc"],
    MPI: ["openmpi", "mpich", "mvapich", "impi"],
    Libraries: ["boost", "hdf5", "netcdf", "zlib", "lib"],
    Tools: ["cmake", "autoconf", "automake", "git", "vim", "emacs"],
  };

  const lowerName = packageName.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => lowerName.startsWith(kw) || lowerName.includes(kw))) {
      return category;
    }
  }
  return "Other";
};

export function buildPackages(modules: RawModule[]): ModulePackage[] {
  const groups = new Map<string, { versions: PackageVersion[]; description?: string }>();

  for (const mod of modules) {
    if (!mod?.package) continue;
    const parsed = parseModuleName(mod.package);
    const rawVersions = !mod.versions ? [] : Array.isArray(mod.versions) ? mod.versions : [mod.versions];
    const group = groups.get(parsed.baseName) ?? { versions: [] };

    for (const ver of rawVersions) {
      const prereqs = ver.parent ?? [];
      const compilers = new Set<string>();
      const fromName = parsed.compiler && compilerLabel(parsed.compiler);
      if (fromName) compilers.add(fromName);
      for (const dep of prereqs.flat()) {
        const label = compilerLabel(dep);
        if (label) compilers.add(label);
      }

      group.versions.push({
        label: ver.versionName || parsed.version || ver.full || "default",
        full: ver.full || mod.package,
        prereqs,
        compilers: [...compilers],
        isDefault:
          !!ver.markedDefault ||
          (typeof mod.defaultVersionName === "string" && ver.versionName === mod.defaultVersionName),
        help: ver.help,
        path: ver.path,
      });
    }
    if (!group.description && mod.description) group.description = mod.description;
    groups.set(parsed.baseName, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.versions.length > 0)
    .map(([name, group]) => {
      const versions = group.versions.sort((a, b) => compareVersions(a.label, b.label));
      // A default that needs no prerequisites, otherwise any default, otherwise the newest
      const defaultFree = versions.findIndex((v) => v.isDefault && v.prereqs.length === 0);
      const anyDefault = versions.findIndex((v) => v.isDefault);
      const primary = defaultFree >= 0 ? defaultFree : anyDefault >= 0 ? anyDefault : 0;
      const help = versions[primary].help || versions.find((v) => v.help)?.help;

      return {
        name,
        description: group.description || extractDescription(help),
        category: extractCategory(name),
        compilers: [...new Set(versions.flatMap((v) => v.compilers))].sort((a, b) => compareVersions(b, a)),
        versions,
        primary,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
