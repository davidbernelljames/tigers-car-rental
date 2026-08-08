"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { availabilitySearchSchema, MIN_RENTAL_DAYS } from "@/lib/validations/booking";

interface AvailabilitySearchProps {
  variant?: "hero" | "inline";
  className?: string;
}

// S1-003 / S2 search widget. On submit, navigates to S2 Vehicles & Book with
// the date range passed as query params — Algorithm A-01 runs per-vehicle
// once the customer selects one, per the Pseudocode document.
export function AvailabilitySearch({ variant = "hero", className }: AvailabilitySearchProps) {
  const router = useRouter();
  const [pickupDate, setPickupDate] = React.useState("");
  const [returnDate, setReturnDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  // Caps the calendar at the longest rental the schema accepts, so the picker
  // cannot offer a date that validation will then reject.
  const maxDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split("T")[0];
  })();
  // Return date can't be selected earlier than pickup + the minimum rental
  // length — guides the calendar itself rather than only rejecting on
  // submit, matching how maxDateStr already caps the far end.
  const minReturnDate = (() => {
    const base = pickupDate ? new Date(pickupDate) : new Date(todayStr);
    base.setDate(base.getDate() + MIN_RENTAL_DAYS);
    return base.toISOString().split("T")[0];
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Shared schema rather than a local check, so this widget and the S4
    // date picker cannot drift apart on what counts as a valid range.
    const parsed = availabilitySearchSchema.safeParse({ pickupDate, returnDate });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid date range.");
      return;
    }
    setError(null);

    const params = new URLSearchParams({ pickup: pickupDate, return: returnDate });
    router.push(`/vehicles?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end",
        variant === "hero"
          ? "rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur"
          : "",
        className
      )}
    >
      <div className="flex-1">
        <Label htmlFor="pickupDate">Pickup Date</Label>
        <input
          id="pickupDate"
          type="date"
          min={todayStr}
          max={maxDateStr}
          value={pickupDate}
          onChange={(e) => setPickupDate(e.target.value)}
          className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-customer-light"
        />
      </div>
      <div className="flex-1">
        <Label htmlFor="returnDate">Return Date</Label>
        <input
          id="returnDate"
          type="date"
          min={minReturnDate}
          max={maxDateStr}
          value={returnDate}
          onChange={(e) => setReturnDate(e.target.value)}
          className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-customer-light"
        />
      </div>
      <Button type="submit" size="lg" className="sm:w-auto">
        <Search className="h-4 w-4" />
        Search
      </Button>
      {error && (
        <p className="text-sm text-status-maintenance sm:absolute sm:-bottom-6">
          {error}
        </p>
      )}
    </form>
  );
}
