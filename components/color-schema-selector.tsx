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
      "#047857", // bg-green-700
      "#9333ea", // bg-indigo-500
      "#7c2d12", // bg-red-900
      "#1d4ed8", // bg-blue-400
    ],
  },
  {
    value: "frost",
    label: "Frost",
    colors: [
      "#0891b2", // bg-cyan-600
      "#0284c7", // bg-sky-700
      "#4f46e5", // bg-indigo-600
      "#0f766e", // bg-teal-600
    ],
  },
  {
    value: "sunset",
    label: "Sunset",
    colors: [
      "#d97706", // bg-amber-600
      "#e11d48", // bg-rose-600
      "#db2777", // bg-pink-700
      "#ea580c", // bg-orange-600
    ],
  },
  {
    value: "earth",
    label: "Earth",
    colors: [
      "#047857", // bg-emerald-700
      "#6d28d9", // bg-violet-700
      "#b45309", // bg-amber-700
      "#0369a1", // bg-sky-700
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
