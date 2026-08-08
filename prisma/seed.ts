import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// REAL FLEET DATA — confirmed directly with Kadesh (2026), after he sold two
// vehicles and acquired a new one. Four vehicles now, down from five.
//
// Year is no longer tracked at all — Kadesh confirmed it isn't something
// worth capturing for this fleet, so the field was removed from the schema
// entirely rather than left perpetually null. All four remaining vehicles
// have confirmed registration numbers directly from him.
//
// `dailyRate`: TT$300/day for the Tiida and Versa (economy tier);
// TT$350/day for both Corollas (the pricier sedan tier).
//
// CATEGORY: back to two tiers, ECONOMY and SEDAN. WAGON existed for exactly
// one vehicle — the Subaru Legacy Wagon — which has since been sold. Same
// principle as removing SUV/PICKUP earlier: a category with zero vehicles
// isn't a realistic option, it's clutter.
async function main() {
  // Matched on make + model + colour rather than deleted and recreated —
  // see the comment on the loop below for why. This preserves any existing
  // booking's foreign key no matter how many times this script runs.
  const FLEET = [
    {
      make: "Toyota",
      model: "Corolla",
      color: "Black",
      registrationNumber: "PDK 7398", // confirmed with Kadesh
      seats: 5,
      dailyRate: 350, // confirmed by Kadesh
      category: "SEDAN" as const,
      status: "AVAILABLE" as const,
    },
    {
      make: "Toyota",
      model: "Corolla",
      color: "Silver",
      registrationNumber: "PDZ 5470", // confirmed with Kadesh
      seats: 5,
      dailyRate: 350, // confirmed by Kadesh
      category: "SEDAN" as const,
      status: "AVAILABLE" as const,
    },
    {
      make: "Nissan",
      model: "Versa",
      color: "Brown",
      registrationNumber: "PCY 8435", // confirmed with Kadesh
      seats: 5,
      dailyRate: 300, // confirmed by Kadesh
      category: "ECONOMY" as const,
      status: "AVAILABLE" as const,
    },
    {
      make: "Nissan",
      model: "Tiida",
      color: "Silver",
      registrationNumber: "PCM 7456", // confirmed with Kadesh
      seats: 5,
      dailyRate: 300, // confirmed by Kadesh
      category: "ECONOMY" as const,
      status: "AVAILABLE" as const,
    },
  ];

  // [New] Vehicles sold out of the fleet. Retired rather than deleted or
  // silently left out of FLEET above: Vehicle -> Booking is deliberately
  // non-cascading (see that relation's schema comment), so a sold vehicle
  // with real booking history against it can't be deleted, and shouldn't
  // be — the booking record and its rental agreement still need a valid
  // vehicle to point to. RETIRED keeps that history intact while the
  // customer-facing catalog queries explicitly exclude this status, so a
  // sold car can never still be booked.
  const RETIRED = [
    { make: "Nissan", model: "Versa", color: "Red" },
    { make: "Subaru", model: "Legacy Wagon", color: "Grey" },
  ];

  // Matched on make + model + colour rather than deleted and recreated.
  // The original deleteMany({}) approach only worked while the fleet had no
  // real bookings referencing it — once a genuine booking exists,
  // Vehicle -> Booking's non-cascading foreign key correctly refuses to let
  // a referenced vehicle be deleted at all, and this script would fail every
  // time from that point on. Upserting in place means re-running this
  // script (a rate change, a corrected category, a newly sold vehicle) never
  // touches vehicleId, so any existing booking's foreign key stays valid no
  // matter how many times this runs.
  for (const vehicle of FLEET) {
    const existing = await prisma.vehicle.findFirst({
      where: { make: vehicle.make, model: vehicle.model, color: vehicle.color },
    });

    if (existing) {
      await prisma.vehicle.update({
        where: { vehicleId: existing.vehicleId },
        data: vehicle,
      });
    } else {
      await prisma.vehicle.create({ data: vehicle });
    }
  }

  for (const sold of RETIRED) {
    const existing = await prisma.vehicle.findFirst({ where: sold });
    if (existing && existing.status !== "RETIRED") {
      await prisma.vehicle.update({
        where: { vehicleId: existing.vehicleId },
        data: { status: "RETIRED" },
      });
    }
    // If it was never in the database at all (e.g. a fresh install that
    // never had it), there's nothing to retire — correctly a no-op.
  }

  await prisma.systemSettings.upsert({
    where: { settingsId: 1 },
    update: {
      businessEmail: "kadesh306@gmail.com",
      businessPhone: "+1 868-278-7352",
      businessPhoneSecondary: "+1 868-474-1905",
      businessAddress: "4 Ramacharan Drive, Factory Road, Piarco, Trinidad",
      cancellationFeePercent: 25,
      fullRefundWindowHours: 48,
      // [Corrected with Kadesh's actual policy] Previously a recommendation
      // pending his confirmation. His real practice: 1-hour grace period,
      // then a flat TT$100 — not tied to which vehicle was rented.
      lateReturnGraceHours: 1,
      lateFeeAmount: 100,
    },
    create: {
      settingsId: 1,
      businessName: "Tiger's Car Rental",
      businessPhone: "+1 868-278-7352",
      businessPhoneSecondary: "+1 868-474-1905",
      businessEmail: "kadesh306@gmail.com",
      businessAddress: "4 Ramacharan Drive, Factory Road, Piarco, Trinidad",
      cancellationFeePercent: 25,
      fullRefundWindowHours: 48,
      lateReturnGraceHours: 1,
      lateFeeAmount: 100,
    },
  });

  console.log("Seed complete — fleet updated (4 active, 2 retired), late fee policy confirmed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
