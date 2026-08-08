import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium text-neutral-700 mb-1.5 inline-block",
      className
    )}
    {...props}
  >
    {children}
    {required && <span className="text-status-maintenance ml-0.5">*</span>}
  </label>
));
Label.displayName = "Label";

export { Label };
