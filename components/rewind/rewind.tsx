"use server";
import path from "path";
import Link from "next/link";
import DashboardHistory from "./dashboard-history";
import { Separator } from "../ui/separator";

export default async function Rewind() {
  const filePath = path.join(process.cwd(), "public", "modules.json");

  return (
    <div className="mx-auto items-center">
      <Separator className="my-4" />
      <DashboardHistory />
    </div>
  );
}
