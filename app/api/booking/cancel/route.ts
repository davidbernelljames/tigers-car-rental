import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCancellation } from "@/lib/booking";
import { sendCancellationEmail } from "@/lib/email";
import { formatVehicleWithDetails } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { resolveCustomer } from "@/lib/customer-identity";

// ============================================================================
// Booking cancellation — implements the SS1 cancellation policy held in
// SystemSettings (fullRefundWindowHours / cancellationFeePercent).
//
// WHAT THIS DOES AND DOES NOT DO:
// It sets the booking to CANCELLED, releases the vehicle for other customers,
// and RECORDS the refund owed. It does NOT move money — WiPay's payment API
// settles funds to the merchant and offers no programmatic reversal, so the
// refund is issued manually from the WiPay merchant dashboard. The
// `refundDue` / `refundedAt` fields exist precisely so an owed refund is a
// tracked, visible obligation rather than something that depends on someone
// remembering. A Phase 4 admin screen should list bookings where refundDue is
// set and refundedAt is null.
//
// GET  ?ref=TCR-0001  -> preview the outcome without cancelling
// POST { bookingRef } -> perform the cancellation
// ============================================================================

export const dynamic = "force-dynamic";

/**
 * Confirms the caller may act on this booking.
 *
 * A signed-in customer may cancel only their own booking; staff may cancel
 * any. [Corrected] Guests were previously rejected outright here, forcing
 * them to "contact us directly" — inconsistent with the rest of the system,
 * where a guest already proves ownership of a booking by reference + email
 * for both lookup (Find My Booking) and rental extension requests. The same
 * verification now applies here: a guest supplying the correct email for
 * this exact booking may cancel it themselves, without needing an account.
 */
async function authoriseCaller(
  customerId: number,
  customerEmail: string,
  suppliedEmail?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const staff = await prisma.user.findUnique({ where: { authUserId: user.id } });
      if (staff) return true;

      const customer = await resolveCustomer({ id: user.id, email: user.email });
      if (customer && customer.customerId === customerId) return true;
    }
  } catch {
    // Falls through to the guest check below rather than failing closed —
    // an anonymous visitor with no session at all is exactly the guest
    // case this function also needs to authorise correctly.
  }

  // Guest path: same reference + email match already used elsewhere.
  if (suppliedEmail && suppliedEmail.trim().toLowerCase() === customerEmail.toLowerCase()) {
    return true;
  }

  return false;
}

/** Preview the cancellation outcome without committing to it. */
export async function GET(request: NextRequest) {
  const bookingRef = request.nextUrl.searchParams.get("ref");
  if (!bookingRef) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { bookingRef } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.bookingStatus === "CANCELLED") {
    return NextResponse.json({
      alreadyCancelled: true,
      refundDue: booking.refundDue ? Number(booking.refundDue) : 0,
      refunded: !!booking.refundedAt,
    });
  }

  const outcome = await calculateCancellation(booking);
  return NextResponse.json({ preview: true, ...outcome });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bookingRef, email } = body as { bookingRef?: string; email?: string };

  if (!bookingRef) {
    return NextResponse.json({ error: "bookingRef is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    // customer + vehicle are needed for the T-03 cancellation email below.
    include: { customer: true, vehicle: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!(await authoriseCaller(booking.customerId, booking.customer.email, email))) {
    return NextResponse.json(
      {
        error:
          "We couldn't verify this booking. Sign in to the account used to book, or confirm the email address on the booking, then try again.",
      },
      { status: 403 }
    );
  }

  if (booking.bookingStatus === "CANCELLED") {
    return NextResponse.json(
      { error: "This booking has already been cancelled." },
      { status: 409 }
    );
  }
  if (booking.bookingStatus === "COMPLETED") {
    return NextResponse.json(
      { error: "This rental has already been completed and cannot be cancelled." },
      { status: 409 }
    );
  }
  if (booking.bookingStatus === "ON_RENTAL") {
    return NextResponse.json(
      {
        error:
          "This vehicle is currently on rental. Please contact us to arrange an early return.",
      },
      { status: 409 }
    );
  }

  const outcome = await calculateCancellation(booking);

  await prisma.booking.update({
    where: { bookingId: booking.bookingId },
    data: {
      bookingStatus: "CANCELLED",
      cancelledAt: new Date(),
      // Only record a refund obligation if money was actually taken. A PENDING
      // booking that was never paid for owes nothing back.
      refundDue: outcome.refundDue > 0 ? outcome.refundDue : null,
    },
  });

  console.info(
    `[cancel] ${bookingRef}: ${outcome.policyNote}` +
      (outcome.refundDue > 0 ? " — MANUAL REFUND REQUIRED via WiPay dashboard." : "")
  );

  // --- T-03: Cancellation Notification ---
  // Fired here rather than in two places because BOTH cancellation paths in
  // the SS1 trigger definition ("by customer via self-service portal or
  // admin via dashboard") route through this endpoint — the admin Bookings
  // screen calls it too. One dispatch point, no chance of the two paths
  // behaving differently.
  //
  // Failure is logged, never thrown: the booking is already cancelled and
  // the vehicle already released by this point. Failing the request over an
  // email problem would leave the caller thinking the cancellation did not
  // happen, when it did.
  try {
    const settings = await prisma.systemSettings.findFirst();
    const emailResult = await sendCancellationEmail({
      to: booking.customer.email,
      customerName: booking.customer.firstName,
      bookingRef: booking.bookingRef,
      vehicleDescription: formatVehicleWithDetails(booking.vehicle),
      pickupDate: booking.pickupDate.toLocaleDateString("en-GB"),
      cancellationFee: outcome.cancellationFee,
      refundDue: outcome.refundDue,
      policyNote: outcome.policyNote,
      businessName: settings?.businessName ?? "Tiger's Car Rental",
      businessPhone: settings?.businessPhone ?? "",
      businessAddress: settings?.businessAddress ?? "",
    });
    if (!emailResult.sent) {
      console.error(
        `[T-03] Cancellation email not sent for ${bookingRef}: ${emailResult.reason}`
      );
    }
  } catch (err) {
    console.error(`[T-03] Cancellation email threw for ${bookingRef}:`, err);
  }

  return NextResponse.json({
    cancelled: true,
    ...outcome,
    refundNote:
      outcome.refundDue > 0
        ? "Your refund will be processed within 3-5 business days."
        : "No payment had been taken for this booking, so there is nothing to refund.",
  });
}
