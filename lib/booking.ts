import { prisma } from "@/lib/prisma";

export class BookingUnavailableError extends Error {}

// Bulk, date-range availability check across the whole fleet — this is
// what actually powers "real-time availability" on the Vehicles & Book
// grid. Distinct from Vehicle.status (a static, admin-facing field
// describing whether a car is currently checked out or in the shop
// *right now*): a car can show status=AVAILABLE today and still be
// genuinely booked for a future date range a customer is asking about,
// or vice versa. This function is the actual source of truth for whether
// a vehicle can be booked for a *specific* date range, and is shared by
// the grid-level check below and calculateBookingCost's single-vehicle
// check, so the two can never disagree.
export async function getUnavailableVehicleIds(
  pickupDate: Date,
  returnDate: Date
): Promise<Map<number, string>> {
  const reasons = new Map<number, string>();

  const conflictingBookings = await prisma.booking.findMany({
    where: {
      bookingStatus: { in: ["CONFIRMED", "ON_RENTAL"] },
      NOT: {
        OR: [
          { returnDate: { lte: pickupDate } },
          { pickupDate: { gte: returnDate } },
        ],
      },
    },
    select: { vehicleId: true },
  });
  for (const b of conflictingBookings) {
    reasons.set(b.vehicleId, "Already booked for these dates");
  }

  const maintenanceConflicts = await prisma.maintenanceRecord.findMany({
    where: {
      serviceDate: { gte: pickupDate, lte: returnDate },
      status: "SCHEDULED",
    },
    select: { vehicleId: true },
  });
  for (const m of maintenanceConflicts) {
    if (!reasons.has(m.vehicleId)) {
      reasons.set(m.vehicleId, "Scheduled for maintenance during these dates");
    }
  }

  return reasons;
}

export interface UnavailableDateRange {
  start: string; // ISO date, inclusive
  end: string;   // ISO date, inclusive
  reason: "booked" | "maintenance";
}

/**
 * [New] The inverse of getUnavailableVehicleIds above — that function
 * answers "which vehicles are free for this date range", checked once a
 * range is already chosen. This answers "which dates are blocked for this
 * one vehicle", needed up front so a calendar can grey them out before a
 * customer ever picks a conflicting range in the first place, rather than
 * only discovering the conflict after submitting one.
 *
 * Maintenance records are a single service date, not a range, so each one
 * becomes its own one-day blocked range alongside the multi-day booking
 * ranges.
 */
export async function getVehicleUnavailableDates(
  vehicleId: number,
  monthsAhead: number = 3
): Promise<UnavailableDateRange[]> {
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setMonth(windowEnd.getMonth() + monthsAhead);

  const [bookings, maintenanceRecords] = await Promise.all([
    prisma.booking.findMany({
      where: {
        vehicleId,
        bookingStatus: { in: ["CONFIRMED", "ON_RENTAL"] },
        returnDate: { gte: windowStart },
        pickupDate: { lte: windowEnd },
      },
      select: { pickupDate: true, returnDate: true },
    }),
    prisma.maintenanceRecord.findMany({
      where: {
        vehicleId,
        status: "SCHEDULED",
        serviceDate: { gte: windowStart, lte: windowEnd },
      },
      select: { serviceDate: true },
    }),
  ]);

  const ranges: UnavailableDateRange[] = bookings.map((b) => ({
    start: b.pickupDate.toISOString().slice(0, 10),
    end: b.returnDate.toISOString().slice(0, 10),
    reason: "booked" as const,
  }));

  for (const m of maintenanceRecords) {
    const day = m.serviceDate.toISOString().slice(0, 10);
    ranges.push({ start: day, end: day, reason: "maintenance" as const });
  }

  return ranges;
}

export interface BookingCalculation {
  rentalDays: number;
  baseRate: number;
  effectiveRate: number;
  discountApplied: boolean;
  promoCode: string | null;
  totalCost: number;
  /**
   * What the customer pays online now. Under the full-prepayment model this
   * equals totalCost — the whole rental is settled at booking, so there is
   * no balance to collect at pickup and no partial deposit to reconcile.
   */
  amountDueNow: number;
  vehicle: {
    vehicleId: number;
    make: string;
    model: string;
    category: string;
    dailyRate: number;
  };
}

// Core of Algorithm A-01 (Pseudocode document). Throws BookingUnavailableError
// with a user-facing reason if the vehicle cannot be booked for the given range.
export async function calculateBookingCost(
  vehicleId: number,
  pickupDate: Date,
  returnDate: Date
): Promise<BookingCalculation> {
  if (returnDate <= pickupDate) {
    throw new Error("Return date must be after pickup date");
  }

  const rentalDays = Math.ceil(
    (returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Steps 3/4: conflict + maintenance check — shares the same source of
  // truth as the grid-level bulk check above, so a vehicle that shows
  // "available" on the grid can never turn out unavailable here.
  const unavailable = await getUnavailableVehicleIds(pickupDate, returnDate);
  if (unavailable.has(vehicleId)) {
    throw new BookingUnavailableError(unavailable.get(vehicleId)!);
  }

  // Step 5: base rate
  const vehicle = await prisma.vehicle.findUnique({ where: { vehicleId } });
  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  // RETIRED is checked directly here rather than folded into the date-based
  // conflict check above: a vehicle "in maintenance" or "on rental" is
  // temporarily unavailable for a specific range, which is exactly what
  // getUnavailableVehicleIds already models. RETIRED means the vehicle has
  // been sold and no longer exists in the fleet at all — no future date
  // range can ever make it available again, so it's a hard block rather
  // than a date conflict.
  if (vehicle.status === "RETIRED") {
    throw new BookingUnavailableError(
      "This vehicle is no longer part of our fleet."
    );
  }

  const baseRate = Number(vehicle.dailyRate);

  // Step 6/7: best active promotion
  const today = new Date();
  const activePromos = await prisma.promotion.findMany({
    where: {
      vehicleCategory: vehicle.category,
      startDate: { lte: today },
      expiryDate: { gte: today },
      OR: [{ vehicleId: null }, { vehicleId: vehicle.vehicleId }],
    },
    orderBy: { discountPercent: "desc" },
  });

  let effectiveRate = baseRate;
  let discountApplied = false;
  let promoCode: string | null = null;

  if (activePromos.length > 0) {
    const bestPromo = activePromos[0];
    const discountRate = Number(bestPromo.discountPercent) / 100;
    effectiveRate = baseRate - baseRate * discountRate;
    discountApplied = true;
    promoCode = bestPromo.code;
  }

  // Step 8: total cost + deposit
  const settings = await prisma.systemSettings.findFirst();


  const totalCost = Math.round(effectiveRate * rentalDays * 100) / 100;
  // Full prepayment: the entire rental is settled online at booking time,
  // which removes the partial-deposit-plus-balance reconciliation the earlier
  // model required and leaves nothing to collect at pickup.
  const amountDueNow = totalCost;

  return {
    rentalDays,
    baseRate,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    discountApplied,
    promoCode,
    totalCost,
    amountDueNow,
    vehicle: {
      vehicleId: vehicle.vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      dailyRate: baseRate,
    },
  };
}

// Generates the next sequential booking reference in the TCR-#### format
// used throughout the 1st Prototype (e.g. TCR-0044).
export async function generateBookingRef(): Promise<string> {
  const count = await prisma.booking.count();
  const next = count + 1;
  return `TCR-${String(next).padStart(4, "0")}`;
}

export interface CancellationOutcome {
  /** Whether the cancellation falls inside the free-cancellation window. */
  withinFreeWindow: boolean;
  hoursUntilPickup: number;
  amountPaid: number;
  /** Fee retained by the business (0 when cancelled early enough). */
  cancellationFee: number;
  /** What the customer is owed back. */
  refundDue: number;
  policyNote: string;
}

/**
 * Calculates what a customer is owed if they cancel, per the cancellation
 * policy held in SystemSettings (SS1 Section 6.5).
 *
 * A booking cancelled MORE than `fullRefundWindowHours` before pickup is
 * refunded in full. Inside that window, `cancellationFeePercent` of the
 * rental total is retained and the remainder refunded.
 *
 * IMPORTANT — this computes what is OWED; it does not move money. WiPay's
 * payment API settles funds to the merchant and provides no programmatic
 * reversal, so the refund is issued manually from the WiPay merchant
 * dashboard. The `refundDue` / `refundedAt` fields on Booking exist so an
 * unpaid refund is a visible obligation rather than a forgotten one.
 */
export async function calculateCancellation(
  booking: { totalCost: unknown; amountPaid: unknown; pickupDate: Date },
  cancelledAt: Date = new Date()
): Promise<CancellationOutcome> {
  const settings = await prisma.systemSettings.findFirst();
  const windowHours = settings ? settings.fullRefundWindowHours : 48;
  const feePercent = settings ? Number(settings.cancellationFeePercent) : 25;

  const totalCost = Number(booking.totalCost);
  const amountPaid = Number(booking.amountPaid);

  const msUntilPickup = booking.pickupDate.getTime() - cancelledAt.getTime();
  const hoursUntilPickup = msUntilPickup / (1000 * 60 * 60);
  const withinFreeWindow = hoursUntilPickup >= windowHours;

  const cancellationFee = withinFreeWindow
    ? 0
    : Math.round(totalCost * (feePercent / 100) * 100) / 100;

  // Never refund more than was actually paid, and never go negative — a
  // booking cancelled before payment cleared owes nothing back.
  const refundDue = Math.max(
    0,
    Math.round((amountPaid - cancellationFee) * 100) / 100
  );

  return {
    withinFreeWindow,
    hoursUntilPickup: Math.round(hoursUntilPickup * 10) / 10,
    amountPaid,
    cancellationFee,
    refundDue,
    policyNote: withinFreeWindow
      ? `Cancelled more than ${windowHours} hours before pickup — full refund of TT$${refundDue.toFixed(2)}.`
      : `Cancelled within ${windowHours} hours of pickup — ${feePercent}% cancellation fee (TT$${cancellationFee.toFixed(2)}) applies. Refund due: TT$${refundDue.toFixed(2)}.`,
  };
}

export interface LateReturnCharge {
  hoursLate: number;
  withinGrace: boolean;
  amount: number;
  note: string;
}

/**
 * Calculates a late-return charge: a grace period, then a single flat fee.
 *
 * [Corrected with Kadesh's actual policy] Previously modelled as the
 * vehicle's own daily rate per additional day — a reasoned design at the
 * time (explicitly flagged pending his confirmation), on the theory that a
 * flat fee "cannot scale across a fleet where the Corolla costs more than
 * the Versa." His real, stated practice is simpler than that reasoning
 * assumed: one flat fee regardless of which vehicle, applied once the grace
 * period is exceeded — not metered per day late. If it later turns out he
 * actually means per additional day, this is a small, contained change:
 * multiply `amount` by a days-late count the same way the previous version
 * did.
 */
export async function calculateLateReturnCharge(
  scheduledReturn: Date,
  actualReturn: Date
): Promise<LateReturnCharge> {
  const settings = await prisma.systemSettings.findFirst();
  const graceHours = settings ? settings.lateReturnGraceHours : 1;
  const lateFee = settings ? Number(settings.lateFeeAmount) : 100;

  const msLate = actualReturn.getTime() - scheduledReturn.getTime();
  const hoursLate = Math.max(0, msLate / (1000 * 60 * 60));

  if (hoursLate <= graceHours) {
    return {
      hoursLate: Math.round(hoursLate * 10) / 10,
      withinGrace: true,
      amount: 0,
      note: `Returned within the ${graceHours}-hour grace period — no late charge.`,
    };
  }

  return {
    hoursLate: Math.round(hoursLate * 10) / 10,
    withinGrace: false,
    amount: lateFee,
    note: `Returned ${Math.round(hoursLate)} hours late (grace period ${graceHours} hour${graceHours === 1 ? "" : "s"}). Late fee: TT$${lateFee.toFixed(2)}.`,
  };
}

export interface ExtensionAvailability {
  available: boolean;
  reason?: string;
}

/**
 * Checks whether a single vehicle is free for a proposed rental extension
 * window — Algorithm A-05 (Rental Extension Request).
 *
 * Deliberately a distinct query from getUnavailableVehicleIds() above,
 * rather than reusing it directly: that function checks every vehicle at
 * once for the customer-facing catalogue, with no notion of "excluding the
 * booking that's currently being extended." Checking a single vehicle
 * against an extension window WITHOUT excluding the booking's own existing
 * reservation would risk a false conflict at the exact boundary where the
 * original rental's return date touches the start of the extension window.
 * The underlying logic — booking overlap, then maintenance overlap — is the
 * same as the customer-facing check; only the scope differs.
 */
export async function checkVehicleAvailableForExtension(
  vehicleId: number,
  excludeBookingId: number,
  windowStart: Date,
  windowEnd: Date
): Promise<ExtensionAvailability> {
  const conflict = await prisma.booking.findFirst({
    where: {
      vehicleId,
      bookingId: { not: excludeBookingId },
      bookingStatus: { in: ["CONFIRMED", "ON_RENTAL"] },
      NOT: {
        OR: [
          { returnDate: { lte: windowStart } },
          { pickupDate: { gte: windowEnd } },
        ],
      },
    },
  });
  if (conflict) {
    return {
      available: false,
      reason: `This vehicle is already booked during part of the requested extension (${conflict.bookingRef}).`,
    };
  }

  const maintenance = await prisma.maintenanceRecord.findFirst({
    where: {
      vehicleId,
      serviceDate: { gte: windowStart, lte: windowEnd },
      status: "SCHEDULED",
    },
  });
  if (maintenance) {
    return {
      available: false,
      reason: "This vehicle is scheduled for maintenance during part of the requested extension.",
    };
  }

  return { available: true };
}
