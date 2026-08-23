import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted",
        ghost:
          "text-foreground hover:bg-muted",
        // Souligné DÈS l'état par défaut, pas seulement au survol : le
        // contraste entre le bleu du lien et le gris du texte environnant est
        // de 1,46:1, très en dessous du minimum de 3:1. La couleur seule ne
        // distingue donc pas le lien, ce qui le rend invisible aux personnes
        // daltoniennes ou en contraste réduit (RGAA 10.6, WCAG 1.4.1).
        link:
          "text-[color:var(--brand-secondary)] underline underline-offset-4 hover:no-underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        sm: "h-11 px-3 sm:h-9",
        default: "h-11 px-4 py-2 sm:h-10",
        lg: "h-11 px-6 text-base",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
