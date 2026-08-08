import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { pickupDetailsSchema } from "@/lib/validations/admin";

// Records mileage and fuel level at vehicle handover. These two fields were
// added to the schema back in Phase 3 specifically for this screen — they're
// genuinely unknowable at online payment time (the customer hasn't seen the
// car yet), so the rental agreement PDF generates with them blank, and this
// is where staff fill them in once the vehicle physically changes hands.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = pickupDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid pickup details" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({ where: { bookingId } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.bookingStatus !== "CONFIRMED" && booking.bookingStatus !== "ON_RENTAL") {
    return NextResponse.json(
      { error: "Pickup details can only be recorded for a confirmed booking." },
      { status: 409 }
    );
  }

  const updated = await prisma.booking.update({
    where: { bookingId },
    data: {
      mileageAtPickup: parsed.data.mileageAtPickup,
      fuelLevelAtPickup: parsed.data.fuelLevelAtPickup,
    },
  });

  return NextResponse.json({
    bookingId: updated.bookingId,
    mileageAtPickup: updated.mileageAtPickup,
    fuelLevelAtPickup: updated.fuelLevelAtPickup,
  });
}
