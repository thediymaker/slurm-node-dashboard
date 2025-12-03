"use client";

import {
  Github,
  LifeBuoy,
  Book,
  Info,
  Monitor,
  Sun,
  Moon,
  Menu,
  Home,
  Box,
  History,
  BarChart
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import packageJson from "@/package.json";

interface HeaderMenuProps {
  username?: string;
}

export default function HeaderMenu({ username = "RC User" }: HeaderMenuProps) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || "#";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10">
          <Menu className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Hello, {username}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/" className="w-full cursor-pointer">
              <Home className="mr-2 h-4 w-4" />
              <span>Home</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/modules" className="w-full cursor-pointer">
              <Box className="mr-2 h-4 w-4" />
              <span>Modules</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/rewind" className="w-full cursor-pointer">
              <History className="mr-2 h-4 w-4" />
              <span>Historical</span>
            </Link>
          </DropdownMenuItem>
          {process.env.NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN === 'true' && (
            <DropdownMenuItem asChild>
              <Link href="/metrics" className="w-full cursor-pointer">
                <BarChart className="mr-2 h-4 w-4" />
                <span>Job Metrics</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="https://slurmdash.com" target="_blank" className="w-full cursor-pointer">
              <Book className="mr-2 h-4 w-4" />
              <span>View Docs</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={supportUrl} target="_blank" className="w-full cursor-pointer">
              <LifeBuoy className="mr-2 h-4 w-4" />
              <span>Support</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="https://github.com/thediymaker/slurm-node-dashboard" target="_blank" className="w-full cursor-pointer">
              <Github className="mr-2 h-4 w-4" />
              <span>GitHub</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Info className="mr-2 h-4 w-4" />
            <span>About</span>
            <DropdownMenuShortcut>{packageJson.version}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between p-2">
          <span className="text-sm pl-2">Theme</span>
          <div className="flex items-center border rounded-md p-1">
            <Button
              variant={theme === "system" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => setTheme("system")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={theme === "light" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              variant={theme === "dark" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
