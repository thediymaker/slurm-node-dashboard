"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import HeaderMenu from "@/components/header/header-menu";
import ColorSchemaSelector from "@/components/color-schema-selector";
import JobSearch from "@/components/job-search";
import { useRuntimeConfig } from "@/components/runtime-config";
import { useColorSchema } from "@/components/use-color-schema";
import ChatModal from "@/components/modals/chat-modal";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

// Pages that share the app header; admin and login have their own
const APP_PAGES = ["/", "/rewind", "/modules", "/metrics"];

// One header for every page, rendered by the root layout so it sits in the
// same place everywhere
export default function AppHeader({ username }: { username?: string }) {
  const { clusterName, clusterLogo, features } = useRuntimeConfig();
  const pathname = usePathname() ?? "/";
  const [colorSchema, setColorSchema] = useColorSchema();
  const [showChat, setShowChat] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  if (!APP_PAGES.some(isActive)) return null;

  const nav = [
    { href: "/", label: "Nodes", show: true },
    { href: "/rewind", label: "Rewind", show: features.rewind.enabled },
    { href: "/modules", label: "Modules", show: features.modules.enabled },
    { href: "/metrics", label: "Metrics", show: features.jobMetrics.enabled },
  ].filter((item) => item.show);

  return (
    <header className="sticky top-0 z-30 mb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex min-h-14 max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
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
          {features.ai.enabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Open assistant"
              aria-pressed={showChat}
              onClick={() => setShowChat(!showChat)}
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          )}
          <ColorSchemaSelector value={colorSchema} onChange={setColorSchema} />
          <HeaderMenu username={username} />
        </div>
      </div>
      {features.ai.enabled && <ChatModal showChat={showChat} setShowChat={setShowChat} />}
    </header>
  );
}
