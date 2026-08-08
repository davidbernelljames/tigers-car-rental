"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ============================================================================
// S3 Booking Details — Availability Calendar.
//
// [New] Previously, unavailability for a specific vehicle and date range
// only surfaced after submitting the date form on this same page, an extra
// click purely to find out a range didn't work. This replaces the native
// date inputs with a real calendar that shows blocked dates directly,
// before a customer ever picks a conflicting range in the first place.
//
// Blocking logic deliberately mirrors the exact boundary rules already
// used server side (getUnavailableVehicleIds / getVehicleUnavailableDates
// in lib/booking.ts), not just an approximation — a booking's own return
// day is a valid new pickup day (back to back rentals are fine), so that
// boundary day stays selectable here too. A maintenance day is a single,
// fully blocked day with no such exception. Getting this boundary wrong
// would just recreate the same "calendar said available but got rejected"
// problem this component exists to remove.
// ============================================================================

interface UnavailableRange {
  start: string; // ISO date, inclusive
  end: string;   // ISO date, inclusive
  reason: "booked" | "maintenance";
}

export interface AvailabilityCalendarProps {
  vehicleId: number;
  pickupDate: string;
  returnDate: string;
  onChange: (pickup: string, returnD: string) => void;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

export function AvailabilityCalendar({
  vehicleId,
  pickupDate,
  returnDate,
  onChange,
}: AvailabilityCalendarProps) {
  const [ranges, setRanges] = React.useState<UnavailableRange[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMonth, setViewMonth] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [pendingPickup, setPendingPickup] = React.useState<string | null>(
    pickupDate || null
  );

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/vehicles/${vehicleId}/unavailable-dates`)
      .then((res) => res.json())
      .then((data) => setRanges(data.unavailable ?? []))
      .finally(() => setLoading(false));
  }, [vehicleId]);

  // A day is blocked as a PICKUP if it falls on or after a booked range's
  // start and strictly before its end (the return day itself is a valid
  // new pickup), or anywhere within a maintenance day's full inclusive
  // range (a single day, but written generally in case that ever changes).
  const isBlocked = React.useCallback(
    (iso: string): boolean => {
      return ranges.some((r) => {
        if (r.reason === "booked") {
          return iso >= r.start && iso < r.end;
        }
        // maintenance — fully inclusive, no back-to-back exception
        return iso >= r.start && iso <= r.end;
      });
    },
    [ranges]
  );

  const today = toISO(new Date());

  function handleDayClick(iso: string) {
    if (iso < today || isBlocked(iso)) return;

    if (!pendingPickup) {
      setPendingPickup(iso);
      onChange(iso, "");
      return;
    }

    if (iso <= pendingPickup) {
      // Clicking on or before the current pickup restarts the selection
      // rather than producing an invalid or zero-length range.
      setPendingPickup(iso);
      onChange(iso, "");
      return;
    }

    // Reject a candidate return if any blocked day falls strictly between
    // the chosen pickup and this candidate — a range that would cross a
    // conflict is invalid even if this specific end day looks free on its
    // own.
    let d = parseISO(pendingPickup);
    const end = parseISO(iso);
    while (d < end) {
      if (isBlocked(toISO(d))) {
        // Start a fresh selection from this day instead of silently
        // rejecting with no feedback.
        setPendingPickup(iso);
        onChange(iso, "");
        return;
      }
      d = new Date(d);
      d.setDate(d.getDate() + 1);
    }

    onChange(pendingPickup, iso);
    setPendingPickup(null);
  }

  function renderMonth(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const iso = toISO(dateObj);
      const past = iso < today;
      const blocked = isBlocked(iso);
      const isPickup = iso === pendingPickup || iso === pickupDate;
      const isReturn = iso === returnDate && returnDate !== "";
      const inRange =
        pendingPickup &&
        iso > pendingPickup &&
        returnDate &&
        iso < returnDate;

      const disabled = past || blocked;

      cells.push(
        <button
          key={iso}
          type="button"
          disabled={disabled}
          onClick={() => handleDayClick(iso)}
          title={blocked ? "Unavailable" : undefined}
          className={[
            "h-9 w-9 rounded-md text-sm flex items-center justify-center",
            disabled
              ? "text-neutral-300 line-through cursor-not-allowed bg-neutral-50"
              : "hover:bg-customer-light cursor-pointer",
            isPickup || isReturn ? "bg-customer text-white hover:bg-customer" : "",
            inRange && !isPickup && !isReturn ? "bg-customer-light" : "",
          ].join(" ")}
        >
          {day}
        </button>
      );
    }

    return (
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2 text-center">
          {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <div className="grid grid-cols-7 gap-1 text-xs text-neutral-400 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="h-6 flex items-center justify-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="p-1 rounded hover:bg-neutral-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs text-neutral-400">
          {loading ? "Checking availability…" : "Select a pickup date, then a return date"}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1 rounded hover:bg-neutral-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {renderMonth(viewMonth)}
        {renderMonth(addMonths(viewMonth, 1))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-customer inline-block" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-neutral-100 border border-neutral-300 inline-block" /> Unavailable
        </span>
      </div>
    </div>
  );
}
