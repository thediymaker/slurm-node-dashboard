"use client";

import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

interface ViewToggleButtonsProps {
  isGroupedView: boolean;
  handleViewModeChange: (value: boolean) => void;
}

const ViewToggleButtons = ({
  isGroupedView,
  handleViewModeChange,
}: ViewToggleButtonsProps) => {
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={!isGroupedView ? "default" : "secondary"}
        size="sm"
        onClick={() => handleViewModeChange(false)}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={isGroupedView ? "default" : "secondary"}
        size="sm"
        onClick={() => handleViewModeChange(true)}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ViewToggleButtons;
