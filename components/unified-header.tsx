"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderMenu from "@/components/header/header-menu";
import ColorSchemaSelector from "@/components/color-schema-selector";
import JobSearch from "@/components/job-search";
import { useRuntimeConfig } from "@/components/runtime-config";
import { getRandomGeekName } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";

interface UnifiedHeaderProps {
  // Kept for the pages that pass them; the nav shows which page is open
  title?: string;
  description?: string;
  username?: string;
  // The nodes page owns the color scheme; other pages keep it here
  colorSchema?: string;
  onColorSchemaChange?: (value: string) => void;
}

export default function UnifiedHeader({ username, colorSchema: controlledSchema, onColorSchemaChange }: UnifiedHeaderProps) {
  const { clusterName, clusterLogo, features } = useRuntimeConfig();
  const pathname = usePathname();
  const [localSchema, setLocalSchema] = useState(() => {
    try {
      return (typeof window !== "undefined" && localStorage.getItem("colorSchema")) || "default";
    } catch {
      return "default";
    }
  });
  const [displayUsername, setDisplayUsername] = useState(username);

  useEffect(() => {
    // Get username from cookie if not provided
    if (!username) {
      const cookieUsername = document.cookie
        .split("; ")
        .find((row) => row.startsWith("SSONAME="))
        ?.split("=")[1];
      setDisplayUsername(cookieUsername || getRandomGeekName());
    }
  }, [username]);

  const colorSchema = controlledSchema ?? localSchema;
  const handleColorSchemaChange = (value: string) => {
    if (onColorSchemaChange) {
      onColorSchemaChange(value);
    } else {
      setLocalSchema(value);
      localStorage.setItem("colorSchema", value);
    }
  };

  const nav = [
    { href: "/", label: "Nodes", show: true },
    { href: "/rewind", label: "Rewind", show: features.rewind.enabled },
    { href: "/modules", label: "Modules", show: features.modules.enabled },
    { href: "/metrics", label: "Metrics", show: features.jobMetrics.enabled },
  ].filter((item) => item.show);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <header className="sticky top-0 z-30 -mx-2 mb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80">
          {clusterLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(clusterLogo)} alt="" className="h-6 w-6 object-contain" />
          )}
          <span className="text-[15px] font-semibold tracking-tight">{clusterName || "Cluster"}</span>
        </Link>
        <nav aria-label="Main" className="-mx-1 flex gap-0.5 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(item.href) && "bg-muted font-medium text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <JobSearch />
          <ColorSchemaSelector value={colorSchema} onChange={handleColorSchemaChange} />
          <HeaderMenu username={displayUsername} />
        </div>
      </div>
    </header>
  );
}
