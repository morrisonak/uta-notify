import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const statCardVariants = cva("rounded-xl border p-4", {
  variants: {
    variant: {
      default: "bg-card",
      warning: "bg-amber-50 border-amber-200",
      success: "bg-green-50 border-green-200",
      danger: "bg-red-50 border-red-200",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  tooltip?: string;
}

function StatCard({
  title,
  value,
  description,
  icon,
  variant,
  tooltip,
  className,
  ...props
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ variant }), className)} {...props}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground/50 hover:text-muted-foreground">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon && <div className="rounded-lg bg-muted p-2">{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export { StatCard, statCardVariants };
