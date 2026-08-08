"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { CricketSpinner } from "@/components/ui/cricket-spinner";

type VehicleListItem = {
  vehicleId: number;
  make: string;
  model: string;
  color: string;
  seats: number;
  dailyRate: number;
  category: string;
  status: "AVAILABLE" | "ON_RENTAL" | "IN_MAINTENANCE";
  photoUrl: string | null;
  promoDiscountPercent?: number | null;
};

export function VehicleFilterGrid({ vehicles }: { vehicles: VehicleListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [category, setCategory] = React.useState("ALL");

  const pickup = searchParams.get("pickup");
  const returnD = searchParams.get("return");
  const datesEntered = Boolean(pickup && returnD);

  // Real date-range availability, fetched once dates are entered — this is
  // what makes "real-time availability" actually true, rather than only
  // reflecting each vehicle's static current status (see lib/booking.ts
  // for why those are two different things).
  const [dateUnavailable, setDateUnavailable] = React.useState<Record<
    number,
    string
  > | null>(null);
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);

  React.useEffect(() => {
    if (!datesEntered) {
      setDateUnavailable(null);
      return;
    }
    setCheckingAvailability(true);
    fetch("/api/vehicles/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupDate: pickup, returnDate: returnD }),
    })
      .then((res) => res.json())
      .then((data) => setDateUnavailable(data.unavailable ?? {}))
      .finally(() => setCheckingAvailability(false));
  }, [datesEntered, pickup, returnD]);

  const filtered =
    category === "ALL" ? vehicles : vehicles.filter((v) => v.category === category);

  function bookHref(vehicleId: number) {
    const params = new URLSearchParams({ vehicleId: String(vehicleId) });
    if (pickup) params.set("pickup", pickup);
    if (returnD) params.set("return", returnD);
    return `/booking/details?${params.toString()}`;
  }

  // Combines the static status (maintenance still hard-blocks regardless of
  // dates — a car that's actually in the shop isn't bookable no matter what
  // future range is requested) with the real date-conflict check.
  function getAvailabilityOverride(vehicle: VehicleListItem) {
    if (!datesEntered) return undefined;

    if (vehicle.status === "IN_MAINTENANCE") {
      return { bookable: false, label: "In Maintenance", reason: undefined };
    }
    if (dateUnavailable && vehicle.vehicleId in dateUnavailable) {
      return {
        bookable: false,
        label: "Unavailable for These Dates",
        reason: dateUnavailable[vehicle.vehicleId],
      };
    }
    return { bookable: true, label: "Available for These Dates", reason: undefined };
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
        <div className="w-full sm:w-56">
          <Label htmlFor="category">Category</Label>
          <Select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="ECONOMY">Economy</option>
            <option value="SEDAN">Sedan</option>
          </Select>
        </div>
        {datesEntered && !checkingAvailability && (
          <p className="text-sm text-neutral-500">
            Showing real-time availability for{" "}
            <span className="font-medium text-neutral-700">
              {pickup} → {returnD}
            </span>
          </p>
        )}
      </div>

      {checkingAvailability ? (
        <CricketSpinner label="Checking real-time availability…" />
      ) : filtered.length === 0 ? (
        <p className="text-neutral-500 py-12 text-center">
          No vehicles match this category right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <VehicleCard
              key={v.vehicleId}
              vehicle={v}
              bookHref={bookHref(v.vehicleId)}
              availabilityOverride={getAvailabilityOverride(v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
