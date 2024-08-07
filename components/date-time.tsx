// components/DateTimePicker.tsx
"use client";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock } from "lucide-react";

interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  time: string | undefined;
  setTime: (time: string | undefined) => void;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  date,
  setDate,
  time,
  setTime,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const generateTimeOptions = (): string[] => {
    const options: string[] = [];
    for (let i = 0; i < 24; i++) {
      options.push(`${i.toString().padStart(2, "0")}:00`);
    }
    return options;
  };

  if (!isMounted) {
    return <div>Loading...</div>; // or any other placeholder
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
          {time && (
            <>
              <Clock className="ml-2 mr-2 h-4 w-4" />
              <span>{time}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            setDate(newDate);
            if (newDate && !time) {
              setTime("00:00");
            }
          }}
          initialFocus
        />
        <div className="p-3 border-t">
          <Select
            value={time}
            onValueChange={(newTime) => {
              setTime(newTime);
              if (newTime && !date) {
                setDate(new Date());
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {generateTimeOptions().map((timeOption) => (
                <SelectItem key={timeOption} value={timeOption}>
                  {timeOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
};
