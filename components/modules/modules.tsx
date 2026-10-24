import { Suspense } from "react";
import { Separator } from "../ui/separator";
import ModuleBrowser from "./module-browser";
import fs from "fs-extra";
import { getModulesFile } from "@/lib/config";
import { Package } from "lucide-react";
import { buildPackages, type ModulePackage, type RawModule } from "./module-utils";

async function fetchData(): Promise<ModulePackage[]> {
  const filePath = getModulesFile();
  try {
    const jsonData = await fs.readFile(/*turbopackIgnore: true*/ filePath, "utf-8");
    const data: RawModule[] = JSON.parse(jsonData);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No valid data");
    }
    // Grouped here so the page ships one entry per package
    return buildPackages(data);
  } catch (err) {
    console.error("Error reading or parsing modules.json:", err);
    return [];
  }
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="p-4 rounded-full bg-primary/10 mb-4">
        <Package className="w-8 h-8 text-primary animate-pulse" />
      </div>
      <p className="text-muted-foreground">Loading modules...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="p-4 rounded-full bg-red-500/10 mx-auto w-fit mb-4">
        <Package className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-red-400 font-medium">No modules data found</p>
      <p className="text-sm text-muted-foreground mt-2">
        Add public/modules.json, or set MODULES_FILE to its path.
      </p>
    </div>
  );
}

function ModuleContent({ data }: { data: ModulePackage[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }
  return <ModuleBrowser packages={data} />;
}

export default async function Modules() {
  const data = await fetchData();

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-6">
      <Separator className="my-4" />
      <Suspense fallback={<LoadingState />}>
        <ModuleContent data={data} />
      </Suspense>
    </div>
  );
}
