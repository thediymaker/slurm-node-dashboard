"use client";
import ModuleHeader from "./module-header";
import { Separator } from "../ui/separator";
import { ModuleTable } from "./module-table";

export default function Modules() {
  return (
    <div className="mx-auto items-center">
      <div className="flex justify-between items-center mb-3">
        <h1 className="font-bold text-2xl">Modules</h1>
        <ModuleHeader />
      </div>
      <Separator />
      <ModuleTable results={[]} filterType={""} handleDelete={undefined} />
    </div>
  );
}
