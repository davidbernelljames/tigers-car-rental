import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { z } from "zod";
import { sendFeedbackRequestEmail } from "@/lib/email";
import { formatVehicleWithDetails } from "@/lib/utils";

// Explicit, valid transitions — matches the real lifecycle rather than
// allowing any status to be set from any other, which would let a booking
// jump straight from PENDING to COMPLETED with no vehicle ever actually
// having been handed over.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ON_RENTAL", "CANCELLED"],
  ON_RENTAL: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

const bodySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "ON_RENTAL", "COMPLETED", "CANCELLED"]),
});

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    // customer + vehicle are needed for the T-04 feedback email below.
    include: { customer: true, vehicle: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const allowed = ALLOWED_TRANSITIONS[booking.bookingStatus] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json(
      {
        error: `Cannot move a booking from ${booking.bookingStatus} to ${parsed.data.status}.`,
      },
      { status: 409 }
    );
  }

  // Marking a booking ON_RENTAL should require pickup details (mileage/fuel)
  // to already be recorded — that's the whole reason those fields exist.
  // Enforced here rather than only suggested in the UI, since this route
  // can be called directly.
  if (
    parsed.data.status === "ON_RENTAL" &&
    (booking.mileageAtPickup === null || booking.fuelLevelAtPickup === null)
  ) {
    return NextResponse.json(
      {
        error:
          "Record the pickup mileage and fuel level before marking this booking On Rental.",
      },
      { status: 409 }
    );
  }

  const updated = await prisma.booking.update({
    where: { bookingId },
    data: { bookingStatus: parsed.data.status },
  });

  // --- T-04: Post-Rental Feedback Request ---
  // SS1 trigger definition: "Admin updates Booking status to Completed via
  // dashboard". This is that moment, and the only place it can happen — the
  // transition table above makes COMPLETED terminal, so a booking can never
  // re-enter this branch by changing status again.
  //
  // The feedbackRequestSentAt guard covers the remaining case: a double
  // click, or two staff hitting Complete at once, which the status check
  // alone would not stop.
  if (parsed.data.status === "COMPLETED" && !booking.feedbackRequestSentAt) {
    try {
      const settings = await prisma.systemSettings.findFirst();

      if (settings && !settings.feedbackNotificationsEnabled) {
        console.info(`[T-04] Feedback requests disabled in settings — skipping ${booking.bookingRef}`);
      } else {
        const baseUrl = (
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        ).replace(/\/$/, "");

        const emailResult = await sendFeedbackRequestEmail({
          to: booking.customer.email,
          customerName: booking.customer.firstName,
          bookingRef: booking.bookingRef,
          vehicleDescription: formatVehicleWithDetails(booking.vehicle),
          reviewUrl: `${baseUrl}/review/${booking.bookingRef}`,
          businessName: settings?.businessName ?? "Tiger's Car Rental",
          businessPhone: settings?.businessPhone ?? "",
          businessAddress: settings?.businessAddress ?? "",
        });

        if (emailResult.sent) {
          await prisma.booking.update({
            where: { bookingId },
            data: { feedbackRequestSentAt: new Date() },
          });
        } else {
          console.error(
            `[T-04] Feedback email not sent for ${booking.bookingRef}: ${emailResult.reason}`
          );
        }
      }
    } catch (err) {
      // Never fails the status change — the rental genuinely is complete
      // whether or not the review request went out.
      console.error(`[T-04] Feedback email threw for ${booking.bookingRef}:`, err);
    }
  }

  return NextResponse.json({ bookingId: updated.bookingId, status: updated.bookingStatus });
}
