import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { formatVehicleWithDetails } from "@/lib/utils";

// ============================================================================
// A5 Customer Records — booking history drill-down.
//
// Lazy-loaded on click rather than preloaded for every customer in the list:
// fetching every customer's full booking history up front would be wasted
// work for the vast majority of rows an owner never clicks into.
//
// Owner-only, matching the rest of A5 — customer contact details and their
// full rental history together are exactly the kind of personal data the
// SS1 role definition keeps away from STAFF_AGENT.
//
// HONEST SCOPE NOTE: this returns real booking history — which vehicles a
// customer has rented, when, and their outcomes — which does genuinely
// support noticing patterns like a preferred vehicle. It does NOT include
// any accident or incident history, because no such thing is tracked
// anywhere in the system today: there is no field on Booking or any related
// table recording an accident, a complaint, or a damage report. Building
// that would be a real, separate feature (a new field or table, plus a
// place for staff to record it) rather than something this endpoint can
// surface from data that doesn't exist yet.
// ============================================================================

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId },
    include: { vehicle: true },
    orderBy: { pickupDate: "desc" },
  });

  // Simple vehicle-preference tally — which vehicle this customer has
  // rented most often, across non-cancelled bookings. Directly answers the
  // "understand customer preferences" part of the request, from data that
  // genuinely exists.
  const vehicleCounts = new Map<string, { label: string; count: number }>();
  for (const b of bookings) {
    if (b.bookingStatus === "CANCELLED") continue;
    const key = String(b.vehicleId);
    const existing = vehicleCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      vehicleCounts.set(key, { label: formatVehicleWithDetails(b.vehicle), count: 1 });
    }
  }
  const preferredVehicle = [...vehicleCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  return NextResponse.json({
    preferredVehicle,
    bookings: bookings.map((b) => ({
      bookingId: b.bookingId,
      bookingRef: b.bookingRef,
      status: b.bookingStatus,
      vehicleLabel: formatVehicleWithDetails(b.vehicle),
      pickupDate: b.pickupDate.toISOString(),
      returnDate: b.returnDate.toISOString(),
      totalCost: Number(b.totalCost),
      amountPaid: Number(b.amountPaid),
    })),
  });
}
