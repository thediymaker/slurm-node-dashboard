import HeaderMenu from "@/components/header/header-menu";
import { ThemeToggle } from "./theme-toggle";

const BaseHeader = () => {
  return (
    <div className="mt-3 justify-between flex ">
      <div className="flex items-center h-full mr-4">
        <ThemeToggle />
        <HeaderMenu />
      </div>
    </div>
  );
};

export default BaseHeader;
