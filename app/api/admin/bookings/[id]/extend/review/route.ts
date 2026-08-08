import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { checkVehicleAvailableForExtension } from "@/lib/booking";
import { z } from "zod";

// ============================================================================
// Algorithm A-05 — Step 2, Staff Review.
//
// Staff's ONLY role here is availability: grant or decline based on whether
// the vehicle is genuinely free for the requested window. Staff never see,
// generate, or touch a WiPay link at any point in this route — that was
// the exact design flaw this whole algorithm was corrected to fix. Payment
// is entirely the customer's own step, in /api/booking/extension-payment,
// reachable only after a grant here.
// ============================================================================

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  action: z.enum(["grant", "decline"]),
  declineReason: z.string().trim().max(255).optional(),
});

export async function POST(
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
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: { vehicle: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.extensionStatus !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "This booking has no extension request currently awaiting review." },
      { status: 409 }
    );
  }

  if (parsed.data.action === "decline") {
    await prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: {
        extensionStatus: "DECLINED",
        extensionDeclineReason: parsed.data.declineReason || null,
      },
    });
    return NextResponse.json({ status: "DECLINED" });
  }

  if (!booking.extensionRequestedReturnDate) {
    return NextResponse.json({ error: "No requested return date on file." }, { status: 409 });
  }

  const availability = await checkVehicleAvailableForExtension(
    booking.vehicleId,
    booking.bookingId,
    booking.returnDate,
    booking.extensionRequestedReturnDate
  );
  if (!availability.available) {
    return NextResponse.json(
      {
        error:
          (availability.reason ?? "This vehicle is no longer available for the requested extension.") +
          " Decline the request, or ask the customer to propose different dates.",
      },
      { status: 409 }
    );
  }

  const additionalDays = Math.ceil(
    (booking.extensionRequestedReturnDate.getTime() - booking.returnDate.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const additionalCost =
    Math.round(additionalDays * Number(booking.vehicle.dailyRate) * 100) / 100;

  await prisma.booking.update({
    where: { bookingId: booking.bookingId },
    data: {
      extensionStatus: "APPROVED_AWAITING_PAYMENT",
      extensionCost: additionalCost,
    },
  });

  return NextResponse.json({ status: "APPROVED_AWAITING_PAYMENT", additionalCost });
}
