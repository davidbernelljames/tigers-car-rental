"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ============================================================================
// A plain <Input type="password"> gives no way to check what was actually
// typed before submitting — a real source of the exact "wait, did I get a
// character wrong" frustration this was built to reduce. Wraps the existing
// Input rather than duplicating its styling, toggling type between
// "password" and "text" on click, with an accessible label that updates
// with the current state.
// ============================================================================

export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
          className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
