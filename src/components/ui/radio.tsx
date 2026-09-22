"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

const RadioGroup = RadioGroupPrimitive.Root;

const Radio = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "h-4 w-4 rounded-full border border-input flex items-center justify-center bg-background",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="h-2.5 w-2.5 rounded-full bg-primary" />
  </RadioGroupPrimitive.Item>
));
Radio.displayName = "Radio";

export { RadioGroup, Radio };
