import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { maintenanceInputSchema } from "@/lib/validations/admin";

// A8 Maintenance Schedule. Write access is staff/owner only — matching the
// RLS policy (see supabase/rls-policies.sql). External providers have no
// login at all — confirmed with Kadesh they're arranged by phone/WhatsApp,
// never through this system — so there is no third role to exclude here.
export async function POST(request: NextRequest) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json();
  const parsed = maintenanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid maintenance details" },
      { status: 400 }
    );
  }

  // [Corrected] This check only ever existed in one direction — booking a
  // vehicle already correctly blocks against a scheduled maintenance date
  // (see getUnavailableVehicleIds in lib/booking.ts), but scheduling
  // maintenance itself never checked the reverse: a vehicle could be sent
  // for service on a day it was already booked out to a customer. Both
  // directions of the same conflict need to be caught, not just one.
  const serviceDate = new Date(parsed.data.serviceDate);
  const bookingConflict = await prisma.booking.findFirst({
    where: {
      vehicleId: parsed.data.vehicleId,
      bookingStatus: { in: ["CONFIRMED", "ON_RENTAL"] },
      pickupDate: { lte: serviceDate },
      returnDate: { gte: serviceDate },
    },
  });
  if (bookingConflict) {
    return NextResponse.json(
      {
        error: `This vehicle is booked (${bookingConflict.bookingRef}) on that date — choose a different service date or vehicle.`,
      },
      { status: 409 }
    );
  }

  const record = await prisma.maintenanceRecord.create({
    data: {
      vehicleId: parsed.data.vehicleId,
      serviceType: parsed.data.serviceType,
      serviceDate: new Date(parsed.data.serviceDate),
      providerId: parsed.data.providerId,
      status: parsed.data.status ?? "SCHEDULED",
    },
  });

  return NextResponse.json(record);
}
