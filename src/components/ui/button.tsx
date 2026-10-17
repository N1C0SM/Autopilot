import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { hapticTap, isNative } from "@/lib/native";

// Sizes come from the `.btn-*` component classes in index.css (UIKit metrics on the
// phone, compact from `md` up) so a utility passed at the call site still wins.
const filled = "bg-primary text-primary-foreground hover:bg-primary/90 active:opacity-80";
const tinted = "bg-primary/15 text-primary hover:bg-primary/20 active:bg-primary/25";
const plain = "text-primary active:opacity-60";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold ring-offset-background transition-[background-color,color,opacity,transform] duration-150 ease-ios-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: filled,
        hero: filled,
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:opacity-80",
        tinted,
        outline: tinted,
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent",
        plain,
        link: `${plain} underline-offset-4 hover:underline`,
        ghost: "hover:bg-secondary active:bg-secondary active:opacity-70",
      },
      size: {
        default: "btn-md",
        sm: "btn-sm",
        lg: "btn-lg [&_svg]:size-[18px]",
        xl: "btn-lg [&_svg]:size-[18px]",
        icon: "btn-icon",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // Main actions give a light tap in the native app, like iOS buttons.
    const primary = !variant || variant === "default" || variant === "hero" || variant === "destructive";
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (primary && isNative()) void hapticTap();
      onClick?.(event);
    };
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} onClick={handleClick} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
