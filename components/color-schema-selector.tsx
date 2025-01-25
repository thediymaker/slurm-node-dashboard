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
    colors: [
      "#60a5fa", // bg-blue-400 (DOWN)
      "#047857", // bg-green-700 (IDLE)
      "#9f1239", // bg-red-900 (ALLOCATED)
      "#6366f1", // bg-indigo-500 (PLANNED)
    ],
  },
  {
    value: "marine",
    label: "Marine",
    colors: [
      "#0891b2", // bg-cyan-600 (DOWN)
      "#14b8a6", // bg-teal-500 (IDLE)
      "#4338ca", // bg-indigo-700 (ALLOCATED)
      "#2563eb", // bg-blue-600 (PLANNED)
    ],
  },
  {
    value: "forest",
    label: "Forest",
    colors: [
      "#059669", // bg-emerald-600 (DOWN)
      "#22c55e", // bg-green-500 (IDLE)
      "#065f46", // bg-emerald-800 (ALLOCATED)
      "#15803d", // bg-green-700 (PLANNED)
    ],
  },
  {
    value: "sunset",
    label: "Sunset",
    colors: [
      "#f97316", // bg-orange-500 (DOWN)
      "#f59e0b", // bg-amber-500 (IDLE)
      "#be123c", // bg-rose-700 (ALLOCATED)
      "#dc2626", // bg-red-600 (PLANNED)
    ],
  },
  {
    value: "aurora",
    label: "Aurora",
    colors: [
      "#8b5cf6", // bg-violet-500 (DOWN)
      "#d946ef", // bg-fuchsia-500 (IDLE)
      "#7e22ce", // bg-purple-700 (ALLOCATED)
      "#4f46e5", // bg-indigo-600 (PLANNED)
    ],
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
