"use server";
import BaseHeader from "../base-header";
import { Separator } from "../ui/separator";
import { ModuleTable } from "./module-table";
import fs from "fs-extra";
import path from "path";
import Link from "next/link";

type Item = {
  package: string;
  versions: [
    {
      help: string;
    }
  ];
};

export default async function Modules() {
  const filePath = path.join(process.cwd(), "public", "modules.json");
  let data: Item[] = [];
  let error = null;

  try {
    const jsonData = fs.readFileSync(filePath, "utf-8");
    data = await JSON.parse(jsonData);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No valid data");
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "An error occurred";
  }

  return (
    <div className="mx-auto items-center">
      <div className="flex justify-between items-center mb-3">
        <h1 className="font-bold text-2xl cursor-pointer">
          <Link href={"/"}>Modules</Link>
        </h1>
        <BaseHeader />
      </div>
      <Separator />
      {error ? (
        <p className="text-red-500">No valid data found</p>
      ) : (
        <ModuleTable results={data} />
      )}
    </div>
  );
}