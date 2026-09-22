import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out transform-gpu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 shadow-sm hover:shadow-md active:translate-y-0.5 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-secondary text-white hover:brightness-110 hover:shadow-lg",
        destructive: "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:brightness-110 hover:shadow-lg",
        outline: "border border-border bg-background/80 text-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground backdrop-blur",
        secondary: "border border-border/70 bg-secondary text-secondary-foreground hover:border-primary/30 hover:bg-secondary/80 hover:text-secondary-foreground",
        ghost: "bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:text-primary hover:underline",
        success: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 hover:shadow-lg",
        pill: "rounded-full",
        capsule: "rounded-[var(--radius-capsule)]",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-14 rounded-xl px-10",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  selected?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, loadingText, leftIcon, rightIcon, selected, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || isLoading;
    const buttonClassName = cn(
      buttonVariants({ variant, size, className }),
      selected && "ring-2 ring-offset-2 ring-primary",
      isDisabled && "opacity-60 pointer-events-none"
    );

    if (asChild) {
      const child = React.Children.only(children);

      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={buttonClassName}
          aria-pressed={selected}
          {...props}
        >
          {child}
        </Slot>
      );
    }

    return (
      <button
        className={buttonClassName}
        ref={ref}
        disabled={isDisabled}
      aria-busy={isLoading || undefined}
        aria-pressed={selected}
        {...props}
      >
        {/* Left icon or spinner */}
        {isLoading ? (
          <span className="dt-spinner" aria-hidden="true" />
        ) : (
          leftIcon && <span className="-ml-1">{leftIcon}</span>
        )}

        {/* Content */}
        <span className={cn(isLoading && "sr-only", !isLoading && "")}>{children}</span>
        {isLoading && loadingText ? <span className="ml-2">{loadingText}</span> : null}

        {/* Right icon */}
        {!isLoading && rightIcon && <span className="-mr-1">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
