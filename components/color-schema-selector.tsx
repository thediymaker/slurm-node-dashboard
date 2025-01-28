import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Paintbrush2Icon } from "lucide-react";

interface ColorSchemaOption {
  value: string;
  label: string;
  colors: string[];
}

const colorSchemaOptions: ColorSchemaOption[] = [
  {
    value: "default",
    label: "Default",
    colors: ["#60a5fa", "#047857", "#ea580c", "#6366f1", "#7c2d12", "#10b981"],
  },
  {
    value: "neon",
    label: "Neon",
    colors: ["#d946ef", "#22d3ee", "#eab308", "#9333ea", "#ec4899", "#2dd4bf"],
  },
  {
    value: "nordic",
    label: "Nordic",
    colors: ["#0d9488", "#34d399", "#4f46e5", "#0ea5e9", "#1e40af", "#22d3ee"],
  },
  {
    value: "candy",
    label: "Candy",
    colors: ["#ec4899", "#4ade80", "#a855f7", "#eab308", "#dc2626", "#3b82f6"],
  },
  {
    value: "desert",
    label: "Desert",
    colors: ["#ea580c", "#fcd34d", "#be185d", "#b91c1c", "#7e22ce", "#f59e0b"],
  },
  {
    value: "ocean",
    label: "Ocean",
    colors: ["#0284c7", "#22d3ee", "#1e40af", "#0d9488", "#1e3a8a", "#06b6d4"],
  },
];

interface ColorSchemaSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const ColorSchemaSelector: React.FC<ColorSchemaSelectorProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
  };

  const currentSchema =
    colorSchemaOptions.find((option) => option.value === value) ||
    colorSchemaOptions[0];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9 p-0">
          <Paintbrush2Icon className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1">
        <div className="space-y-1">
          {colorSchemaOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleSelect(option.value)}
            >
              <div className="flex items-center space-x-2 w-full">
                <div className="flex space-x-1">
                  {option.colors.map((color, index) => (
                    <div
                      key={index}
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs flex-grow">{option.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorSchemaSelector;
