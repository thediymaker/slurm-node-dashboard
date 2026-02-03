import { Suspense } from "react";
import { Separator } from "../ui/separator";
import ModuleGrid from "./module-grid";
import fs from "fs-extra";
import path from "path";
import { Package } from "lucide-react";

type Version = {
  versionName?: string;
  help?: string;
  full?: string;
  path?: string;
  markedDefault?: boolean;
};

type Module = {
  package: string;
  defaultVersionName?: string | boolean;
  versions: Version | Version[];
};

async function fetchData(): Promise<Module[]> {
  const filePath = path.join(process.cwd(), "public", "modules.json");
  try {
    const jsonData = await fs.readFile(filePath, "utf-8");
    const data: Module[] = JSON.parse(jsonData);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No valid data");
    }
    return data;
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
        Please ensure modules.json exists in the public directory.
      </p>
    </div>
  );
}

function ModuleContent({ data }: { data: Module[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }
  return <ModuleGrid modules={data} />;
}

export default async function Modules() {
  const data = await fetchData();

  return (
    <div className="mx-auto max-w-7xl px-4">
      <Separator className="my-4" />
      <Suspense fallback={<LoadingState />}>
        <ModuleContent data={data} />
      </Suspense>
    </div>
  );
}
