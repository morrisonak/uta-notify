import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 text-sm",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive: "bg-red-50 border-red-200 text-red-800 [&>svg]:text-red-600",
        success: "bg-green-50 border-green-200 text-green-800 [&>svg]:text-green-600",
        warning: "bg-amber-50 border-amber-200 text-amber-800 [&>svg]:text-amber-600",
        info: "bg-blue-50 border-blue-200 text-blue-800 [&>svg]:text-blue-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const alertIcons = {
  default: Info,
  destructive: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  showIcon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", icon, showIcon = true, children, ...props }, ref) => {
    const IconComponent = alertIcons[variant || "default"];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <div className="flex gap-3">
          {showIcon && (
            <div className="flex-shrink-0">
              {icon || <IconComponent className="h-4 w-4" />}
            </div>
          )}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
