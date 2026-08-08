import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Choose Vehicle", "Your Details", "Payment"];

export function BookingStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center max-w-xl mx-auto mb-8">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const complete = stepNum < currentStep;
        const active = stepNum === currentStep;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  complete && "bg-status-available text-white",
                  active && "bg-customer text-white",
                  !complete && !active && "bg-neutral-100 text-neutral-400"
                )}
              >
                {complete ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  active ? "text-customer" : "text-neutral-400"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mb-5",
                  complete ? "bg-status-available" : "bg-neutral-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
