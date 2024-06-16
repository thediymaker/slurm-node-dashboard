"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps {
  features: string[];
  defaultValue: string;
  onValueChange: (value: string) => void;
}

export function Combobox({ features, defaultValue, onValueChange }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? "" : currentValue;
    setValue(newValue);
    onValueChange(newValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {value || "All Features"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search feature..." />
          <CommandEmpty>No feature found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="allFeatures"
              onSelect={() => handleSelect("allFeatures")}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === "allFeatures" ? "opacity-100" : "opacity-0"
                )}
              />
              All Features
            </CommandItem>
            {features && features.length > 0 ? (
              features.map((feature) => (
                <CommandItem
                  key={feature}
                  value={feature}
                  onSelect={() => handleSelect(feature)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === feature ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {feature}
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>No features available.</CommandEmpty>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
