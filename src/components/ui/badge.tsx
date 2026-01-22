import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-current",
      },
      severity: {
        low: "bg-green-100 text-green-800",
        medium: "bg-amber-100 text-amber-800",
        high: "bg-orange-100 text-orange-800",
        critical: "bg-red-100 text-red-800",
      },
      status: {
        draft: "bg-gray-100 text-gray-800",
        active: "bg-red-100 text-red-800",
        updated: "bg-amber-100 text-amber-800",
        resolved: "bg-green-100 text-green-800",
        archived: "bg-gray-100 text-gray-500",
      },
      delivery: {
        queued: "bg-blue-100 text-blue-800",
        sending: "bg-amber-100 text-amber-800",
        delivered: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, severity, status, delivery, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, severity, status, delivery }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
