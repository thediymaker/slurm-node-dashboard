"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const SeparatorMed = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border mx-auto",
        orientation === "horizontal" ? "h-[1px] w-[90%]" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
);
SeparatorMed.displayName = SeparatorPrimitive.Root.displayName;

export { SeparatorMed };
