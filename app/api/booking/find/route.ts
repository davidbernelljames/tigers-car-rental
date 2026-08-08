import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatVehicleWithDetails } from "@/lib/utils";
import { z } from "zod";

// ============================================================================
// Guest booking lookup — lets someone who booked WITHOUT an account check
// their booking's status and re-download its rental agreement later,
// without needing Resend configured or an account created at all.
//
// Deliberately a SEPARATE, more guarded endpoint from the existing
// /api/booking/lookup, rather than reusing it directly: that route returns
// full booking details from the reference alone, with no email check at
// all. That was an acceptable risk only in its one existing use — the S5
// payment page, reached immediately after a customer's own browser just
// created that exact booking. Exposing that same behaviour on a public,
// bookmarkable page would make every booking enumerable by anyone guessing
// sequential references (TCR-0001, TCR-0002, ...), which is a real,
// previously-noted risk of the sequential reference scheme. This route
// requires an exact match on BOTH the reference and the email the booking
// was made under before returning anything.
// ============================================================================

export const dynamic = "force-dynamic";

const findSchema = z.object({
  bookingRef: z.string().trim().min(1, "Booking reference is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = findSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: parsed.data.bookingRef.toUpperCase() },
    include: { vehicle: true, customer: true, rentalAgreement: true },
  });

  // Same generic outcome whether the reference doesn't exist at all, or it
  // exists but the email doesn't match — distinguishing the two would tell
  // an enumerator which references are real, exactly what this endpoint
  // exists to prevent.
  if (!booking || booking.customer.email.toLowerCase() !== parsed.data.email) {
    return NextResponse.json(
      { error: "No booking found matching that reference and email." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    bookingRef: booking.bookingRef,
    status: booking.bookingStatus,
    pickupDate: booking.pickupDate,
    returnDate: booking.returnDate,
    totalCost: Number(booking.totalCost),
    amountPaid: Number(booking.amountPaid),
    vehicleLabel: formatVehicleWithDetails(booking.vehicle),
    agreementPath: booking.rentalAgreement?.filePath ?? null,
    extensionStatus: booking.extensionStatus,
    extensionRequestedReturnDate: booking.extensionRequestedReturnDate,
    extensionCost: booking.extensionCost ? Number(booking.extensionCost) : null,
    extensionDeclineReason: booking.extensionDeclineReason,
  });
}
