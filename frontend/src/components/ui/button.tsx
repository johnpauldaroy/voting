import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[9px] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-primary/95 hover:text-primary-foreground hover:shadow-md",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground",
        outline: "border border-input bg-card text-foreground hover:bg-secondary hover:text-primary",
        ghost: "text-foreground hover:bg-secondary hover:text-primary",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:-translate-y-0.5 hover:bg-destructive/90 hover:text-destructive-foreground hover:shadow-md",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[9px] px-3",
        lg: "h-11 rounded-[9px] px-8",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
