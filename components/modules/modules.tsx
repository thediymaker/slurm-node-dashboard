import { Suspense } from "react";
import { Separator } from "../ui/separator";
import { ModuleTable } from "./module-table";
import fs from "fs-extra";
import path from "path";
import Link from "next/link";

type Item = {
  package: string;
  versions: {
    help: string;
  }[];
};

async function fetchData(): Promise<Item[]> {
  const filePath = path.join(process.cwd(), "public", "modules.json");
  try {
    const jsonData = await fs.readFile(filePath, "utf-8");
    const data: Item[] = JSON.parse(jsonData);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No valid data");
    }
    return data;
  } catch (err) {
    console.error("Error reading or parsing modules.json:", err);
    return [];
  }
}

function ModuleContent({ data }: { data: Item[] }) {
  return (
    <>
      {data.length === 0 ? (
        <p className="text-red-500">No valid data found</p>
      ) : (
        <ModuleTable results={data} />
      )}
    </>
  );
}

export default async function Modules() {
  const data = await fetchData();

  return (
    <div className="mx-auto items-center">
      <Separator className="my-4" />
      <Suspense fallback={<p>Loading modules...</p>}>
        <ModuleContent data={data} />
      </Suspense>
    </div>
  );
}
