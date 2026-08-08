import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";

// Marks a cancelled booking's owed refund as issued. This does NOT trigger
// any real refund — WiPay's API has no programmatic reversal, so the actual
// refund is issued manually from the WiPay merchant dashboard first. This
// endpoint just records that it's been done, so the booking stops appearing
// in the "refund still owed" list. Owner-only: this is a financial
// confirmation, not an operational task a rental agent performs.
export async function PATCH(
  request: NextRequest,
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
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { bookingId } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!booking.refundDue) {
    return NextResponse.json(
      { error: "This booking has no refund outstanding." },
      { status: 409 }
    );
  }
  if (booking.refundedAt) {
    return NextResponse.json(
      { error: "This refund has already been marked as issued." },
      { status: 409 }
    );
  }

  const updated = await prisma.booking.update({
    where: { bookingId },
    data: { refundedAt: new Date() },
  });

  return NextResponse.json({ bookingId: updated.bookingId, refundedAt: updated.refundedAt });
}
