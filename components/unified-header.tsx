"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import HeaderMenu from "@/components/header/header-menu";
import ColorSchemaSelector from "@/components/color-schema-selector";
import { getRandomGeekName } from "@/lib/utils";

interface UnifiedHeaderProps {
  title?: string;
  description?: string;
  username?: string;
}

export default function UnifiedHeader({ title, description, username }: UnifiedHeaderProps) {
  const [colorSchema, setColorSchema] = useState("default");
  const [displayUsername, setDisplayUsername] = useState(username);

  useEffect(() => {
    // Load color schema from localStorage
    const savedSchema = localStorage.getItem("colorSchema");
    if (savedSchema) {
      setColorSchema(savedSchema);
    }
    
    // Get username from cookie if not provided
    if (!username) {
      const cookieUsername = document.cookie
        .split("; ")
        .find((row) => row.startsWith("SSONAME="))
        ?.split("=")[1];
      setDisplayUsername(cookieUsername || getRandomGeekName());
    }
  }, [username]);

  const handleColorSchemaChange = (value: string) => {
    setColorSchema(value);
    localStorage.setItem("colorSchema", value);
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-xl border shadow-sm my-4 min-h-[60px]">
      <div className="flex items-center gap-3">
        {title && (
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <h2 className="text-lg font-semibold tracking-tight cursor-pointer">{title}</h2>
          </Link>
        )}
        {description && (
          <>
            <div className="h-4 w-px bg-border" />
            <p className="text-sm text-muted-foreground">{description}</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ColorSchemaSelector
          value={colorSchema}
          onChange={handleColorSchemaChange}
        />
        <div className="h-4 w-px bg-border" />
        <HeaderMenu username={displayUsername} />
      </div>
    </div>
  );
}
