import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import Link from "next/link";

export default function HeaderMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="">
        <Menu className="m-1 w-[30px] h-[30px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mr-4">
        <DropdownMenuLabel className="text-blue-400">Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="font-light cursor-pointer" asChild>
          <Link href={"/"}>Home</Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="font-light cursor-pointer" asChild>
          <Link href={"/modules"}>Modules</Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="font-light" asChild>
          <Link
            target="_blank"
            href={"https://github.com/thediymaker/slurm-node-dashboard"}
          >
            Github
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
