"use client";
import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [_, startTransition] = React.useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size="sm" className="p-0 mx-2" />;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="p-0 mx-2"
      onClick={() => {
        startTransition(() => {
          setTheme(theme === "light" ? "dark" : "light");
        });
      }}
    >
      {theme === "dark" ? (
        <Moon className="transition-all" />
      ) : (
        <Sun className="transition-all" />
      )}
    </Button>
  );
}
