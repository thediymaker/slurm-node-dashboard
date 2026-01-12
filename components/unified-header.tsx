import React from "react";
import Link from "next/link";
import HeaderMenu from "@/components/header/header-menu";
import { cookies } from "next/headers";
import { getRandomGeekName } from "@/lib/utils";

interface UnifiedHeaderProps {
  title?: string;
  description?: string;
}

export default async function UnifiedHeader({ title, description }: UnifiedHeaderProps) {
  const cookieStore = await cookies();
  const username = cookieStore.get("SSONAME")?.value || getRandomGeekName();

  return (
    <div className="flex items-center justify-between space-y-2 mb-6">
      <div>
        {title && (
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <h2 className="text-3xl font-bold tracking-tight cursor-pointer">{title}</h2>
          </Link>
        )}
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center h-full mr-4">
        <HeaderMenu username={username} />
      </div>
    </div>
  );
}
