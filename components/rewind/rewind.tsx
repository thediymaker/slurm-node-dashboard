"use server";
import path from "path";
import Link from "next/link";
import DashboardHistory from "./dashboard-history";
import BaseHeader from "../base-header";
import { Separator } from "../ui/separator";

export default async function Rewind() {
  const filePath = path.join(process.cwd(), "public", "modules.json");

  return (
    <div className="mx-auto items-center">
      <div className="flex justify-between items-center mb-3">
        <h1 className="font-bold text-2xl cursor-pointer">
          <Link href={"/"}>Dashboard History</Link>
        </h1>
        <BaseHeader />
      </div>
      <Separator />
      <DashboardHistory />
    </div>
  );
}
