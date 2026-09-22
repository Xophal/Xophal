"use client";

import * as React from "react";
import * as CheckboxPrimitives from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitives.Root
    ref={ref}
    className={cn(
      "inline-flex h-5 w-5 items-center justify-center rounded-md border border-input bg-background text-foreground focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  >
    <CheckboxPrimitives.Indicator>
      <Check className="h-4 w-4" />
    </CheckboxPrimitives.Indicator>
  </CheckboxPrimitives.Root>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
