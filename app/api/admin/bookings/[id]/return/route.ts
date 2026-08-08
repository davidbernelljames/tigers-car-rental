import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { returnDetailsSchema } from "@/lib/validations/admin";

// Records mileage and fuel level at vehicle return — the other end of the
// rental from the pickup route, and added for the same reason: staff need
// an actual moment to log condition against, not just whatever the next
// customer's pickup happens to show whenever that booking eventually
// happens. This is also what gives Kadesh's fuel policy (returned at the
// same level received) something concrete to check against, rather than
// nothing at all.
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
  const parsed = returnDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid return details" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({ where: { bookingId } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.bookingStatus !== "ON_RENTAL" && booking.bookingStatus !== "COMPLETED") {
    return NextResponse.json(
      { error: "Return details can only be recorded for a booking that is on rental." },
      { status: 409 }
    );
  }
  if (booking.mileageAtPickup !== null && parsed.data.mileageAtReturn < booking.mileageAtPickup) {
    return NextResponse.json(
      { error: `Return mileage cannot be less than the pickup reading (${booking.mileageAtPickup} km).` },
      { status: 400 }
    );
  }

  const updated = await prisma.booking.update({
    where: { bookingId },
    data: {
      mileageAtReturn: parsed.data.mileageAtReturn,
      fuelLevelAtReturn: parsed.data.fuelLevelAtReturn,
    },
  });

  return NextResponse.json({
    bookingId: updated.bookingId,
    mileageAtReturn: updated.mileageAtReturn,
    fuelLevelAtReturn: updated.fuelLevelAtReturn,
  });
}
