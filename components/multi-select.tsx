import React, { useState } from "react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";

interface Option {
  label: string;
  value: string;
}

const MultiSelectComponent: React.FC = () => {
  const [selectedValue, setSelectedValue] = useState<string[]>([]);
  const [openMultipleSelect, setOpenMultipleSelect] = useState<boolean>(false);
  const optionMultipleSelect: Option[] = [
    { label: "Vue3", value: "vue3" },
    { label: "Angular", value: "angular" },
    { label: "React", value: "react" },
  ];

  const isSelected = (value: string): boolean => selectedValue.includes(value);

  const handleUnselected = (item: string): void => {
    setSelectedValue(selectedValue.filter((i) => i !== item));
  };

  const handleOptionSelected = (value: string): void => {
    if (isSelected(value)) {
      setSelectedValue(selectedValue.filter((item) => item !== value));
    } else {
      setSelectedValue([...selectedValue, value]);
    }
    setOpenMultipleSelect(true);
  };

  return (
    <div className="flex gap-2 items-center">
      <label className="text-sm font-medium leading-none mb-0.5">
        Multiple select
      </label>
      <Popover>
        <PopoverTrigger
          asChild
          className={cn(
            "bg-input text-foreground font-inter hover:bg-input",
            !selectedValue.length &&
              "text-inactive-action font-inter hover:text-inactive-action"
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            role="combobox"
            className="w-full justify-between"
            aria-expanded={openMultipleSelect}
          >
            <div className="flex gap-1 flex-wrap">
              {selectedValue.map((item) => (
                <Badge
                  key={item}
                  color="black"
                  className="mr-1"
                  onClick={() => handleUnselected(item)}
                >
                  {item}
                  <button
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUnselected(item)
                    }
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnselected(item);
                    }}
                  >
                    <i className="ph-x-circle h-4 w-4"></i>
                  </button>
                </Badge>
              ))}
            </div>
            <i className="ph-caret-down h-4 w-4"></i>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[570px] p-0">
          <Command>
            <CommandInput placeholder="Search ..." />
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandList>
              <CommandGroup className="max-h-64 overflow-auto">
                {optionMultipleSelect.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleOptionSelected(option.value)}
                  >
                    <i
                      className="ph-check mr-2 h-4 w-4"
                      style={{ opacity: isSelected(option.value) ? 1 : 0 }}
                    ></i>
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MultiSelectComponent;
