import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Paintbrush2Icon } from "lucide-react";
import { COLOR_SCHEMAS } from "@/lib/color-schemas";

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
    COLOR_SCHEMAS.find((option) => option.value === value) || COLOR_SCHEMAS[0];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9 p-0">
          <Paintbrush2Icon className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1">
        <div className="space-y-1">
          {COLOR_SCHEMAS.map((option) => (
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
