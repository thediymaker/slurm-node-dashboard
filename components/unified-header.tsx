import React from "react";
import HeaderMenu from "@/components/header/header-menu";
import { cookies } from "next/headers";
import { getRandomGeekName } from "@/lib/utils";

interface UnifiedHeaderProps {
  title?: string;
  description?: string;
}

export default function UnifiedHeader({ title, description }: UnifiedHeaderProps) {
  const cookieStore = cookies();
  const username = cookieStore.get("SSONAME")?.value || getRandomGeekName();

  return (
    <div className="flex items-center justify-between space-y-2 mb-6">
      <div>
        {title && <h2 className="text-3xl font-bold tracking-tight">{title}</h2>}
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center h-full mr-4">
        <HeaderMenu username={username} />
      </div>
    </div>
  );
}
