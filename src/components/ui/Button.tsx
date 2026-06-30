import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors touch-target disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-dark",
        secondary: "bg-surface border border-line-strong text-ink hover:bg-bg",
        ghost: "border border-dashed border-line-strong text-accent hover:bg-accent-soft",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        md: "px-4 text-[15px]",
        sm: "px-3 min-h-[36px] text-sm",
        lg: "px-6 min-h-[52px] text-base",
        icon: "w-11 h-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
