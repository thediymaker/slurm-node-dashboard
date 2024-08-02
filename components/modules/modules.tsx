"use server";
import ModuleHeader from "./module-header";
import { Separator } from "../ui/separator";
import { ModuleTable } from "./module-table";
import fs from "fs-extra";
import path from "path";

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
  const jsonData = fs.readFileSync(filePath, "utf-8");
  const data: Item[] = await JSON.parse(jsonData);

  return (
    <div className="mx-auto items-center">
      <div className="flex justify-between items-center mb-3">
        <h1 className="font-bold text-2xl">Modules</h1>
        <ModuleHeader />
      </div>
      <Separator />
      <ModuleTable results={data} />
    </div>
  );
}
