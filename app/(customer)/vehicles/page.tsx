import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AvailabilitySearch } from "@/components/booking/availability-search";
import { VehicleFilterGrid } from "@/components/vehicles/vehicle-filter-grid";
import { CricketSpinner } from "@/components/ui/cricket-spinner";

export const dynamic = "force-dynamic";

// S2: Vehicles & Book (Catalogue + Search — consolidated per stakeholder
// feedback). Real-time availability status is read directly from the
// Vehicle table; per-vehicle conflict checking against the requested date
// range happens via Algorithm A-01 once a specific vehicle is selected.
export default async function VehiclesPage() {
  // Excludes RETIRED — a sold vehicle should not appear as bookable.
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: "RETIRED" } },
    orderBy: { vehicleId: "asc" },
  });

  // [New] Same matching logic as calculateBookingCost's promo lookup
  // (lib/booking.ts), applied here across the whole catalogue rather than
  // one vehicle at checkout — otherwise a discount only ever became
  // visible after a customer had already committed to a specific vehicle,
  // well past the point it could actually influence which one they chose.
  const today = new Date();
  const activePromos = await prisma.promotion.findMany({
    where: { startDate: { lte: today }, expiryDate: { gte: today } },
    orderBy: { discountPercent: "desc" },
  });

  function bestDiscountFor(vehicleId: number, category: string): number | null {
    const match = activePromos.find(
      (p) => p.vehicleCategory === category && (p.vehicleId === null || p.vehicleId === vehicleId)
    );
    return match ? Number(match.discountPercent) : null;
  }

  const vehicleData = vehicles.map((v) => ({
    vehicleId: v.vehicleId,
    make: v.make,
    model: v.model,
    color: v.color,
    seats: v.seats,
    dailyRate: Number(v.dailyRate),
    category: v.category,
    // Safe assertion, not a loosening: the query above
    // (`status: { not: "RETIRED" }`) already guarantees this at
    // runtime. TypeScript can't prove that from a where-clause
    // value though, so it correctly flags the full VehicleStatus
    // type as unsafe to narrow silently — asserted here instead
    // of widening the customer-facing type to include RETIRED,
    // which every downstream customer component would then need
    // to account for a state that should be structurally
    // impossible in this context.
    status: v.status as "AVAILABLE" | "ON_RENTAL" | "IN_MAINTENANCE",
    photoUrl: v.photoUrl,
    promoDiscountPercent: bestDiscountFor(v.vehicleId, v.category),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900">Vehicles &amp; Book</h1>
      <p className="text-neutral-500 mt-1 mb-6 max-w-2xl">
        Enter your dates to see real-time availability, then select a vehicle
        to begin booking.
      </p>

      <Suspense>
        <AvailabilitySearch variant="inline" className="mb-8 max-w-2xl" />
      </Suspense>

      <Suspense fallback={<CricketSpinner label="Loading vehicles…" />}>
        <VehicleFilterGrid vehicles={vehicleData} />
      </Suspense>
    </div>
  );
}
