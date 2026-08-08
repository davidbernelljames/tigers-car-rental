import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkVehicleAvailableForExtension } from "@/lib/booking";
import { z } from "zod";

// ============================================================================
// Algorithm A-05: Rental Extension Request — Step 1, Customer Request.
//
// [Corrected] Real testing surfaced a genuine design flaw in the previous
// version: extension requests were admin-initiated, which meant staff ended
// up generating and following the WiPay payment link THEMSELVES — the wrong
// person entering payment details, on behalf of a customer who never saw
// the checkout at all. That's backwards from how every other payment in
// this system works. The corrected flow separates three actions that were
// wrongly collapsed into one:
//   1. CUSTOMER requests an extension (this route)
//   2. STAFF only grants or declines it, based on availability
//      (/api/admin/bookings/[id]/extend/review)
//   3. CUSTOMER alone completes payment, once approved
//      (/api/booking/extension-payment)
//
// Uses the same reference + email verification as Find My Booking, so both
// a signed-in customer and a guest can request an extension the same way —
// there is no login requirement for something a guest booking already
// doesn't require.
// ============================================================================

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  bookingRef: z.string().trim().min(1, "Booking reference is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  proposedReturnDate: z.string().min(1, "A new return date is required"),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: parsed.data.bookingRef.toUpperCase() },
    include: { customer: true, vehicle: true },
  });

  // Same generic-outcome reasoning as Find My Booking: a reference that
  // doesn't exist and a reference with a mismatched email look identical
  // from the outside.
  if (!booking || booking.customer.email.toLowerCase() !== parsed.data.email) {
    return NextResponse.json(
      { error: "No booking found matching that reference and email." },
      { status: 404 }
    );
  }

  if (booking.bookingStatus !== "CONFIRMED" && booking.bookingStatus !== "ON_RENTAL") {
    return NextResponse.json(
      { error: "Only an active or upcoming booking can be extended." },
      { status: 409 }
    );
  }

  // A request already in flight must be resolved (granted/declined, then
  // paid or re-requested) before a new one can be submitted — prevents two
  // overlapping requests for the same booking.
  if (booking.extensionStatus === "PENDING_REVIEW" || booking.extensionStatus === "APPROVED_AWAITING_PAYMENT") {
    return NextResponse.json(
      { error: "There is already an extension request in progress for this booking." },
      { status: 409 }
    );
  }

  const proposedReturnDate = new Date(parsed.data.proposedReturnDate);
  if (isNaN(proposedReturnDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (proposedReturnDate <= booking.returnDate) {
    return NextResponse.json(
      { error: "The new return date must be after the current return date." },
      { status: 400 }
    );
  }

  // Early availability check, purely for immediate customer feedback — not
  // the authoritative one. Staff re-check at grant time regardless, since
  // time passes between a request being submitted and reviewed, during
  // which another booking could genuinely be made.
  const availability = await checkVehicleAvailableForExtension(
    booking.vehicleId,
    booking.bookingId,
    booking.returnDate,
    proposedReturnDate
  );
  if (!availability.available) {
    return NextResponse.json(
      {
        error:
          (availability.reason ?? "This vehicle is not available for the requested extension.") +
          ` The vehicle must be returned by ${booking.returnDate.toLocaleDateString("en-GB")} as originally agreed.`,
      },
      { status: 409 }
    );
  }

  const additionalDays = Math.ceil(
    (proposedReturnDate.getTime() - booking.returnDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const previewCost =
    Math.round(additionalDays * Number(booking.vehicle.dailyRate) * 100) / 100;

  await prisma.booking.update({
    where: { bookingId: booking.bookingId },
    data: {
      extensionStatus: "PENDING_REVIEW",
      extensionRequestedReturnDate: proposedReturnDate,
      extensionCost: previewCost,
      extensionDeclineReason: null,
    },
  });

  return NextResponse.json({
    status: "PENDING_REVIEW",
    requestedReturnDate: proposedReturnDate.toISOString(),
    previewCost,
  });
}
