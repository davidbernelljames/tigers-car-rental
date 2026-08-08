import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        available: "bg-green-50 text-status-available ring-1 ring-inset ring-green-200",
        onRental: "bg-amber-50 text-status-onRental ring-1 ring-inset ring-amber-200",
        maintenance: "bg-red-50 text-status-maintenance ring-1 ring-inset ring-red-200",
        neutral: "bg-neutral-100 text-neutral-700",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot = true, children, ...props }: BadgeProps) {
  const dotColor =
    variant === "available"
      ? "bg-status-available"
      : variant === "onRental"
      ? "bg-status-onRental"
      : variant === "maintenance"
      ? "bg-status-maintenance"
      : "bg-neutral-400";

  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
