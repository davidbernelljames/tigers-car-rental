import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWiPayPaymentRequest } from "@/lib/wipay";
import { isHoldExpired, HOLD_EXPIRED_OUTCOME } from "@/lib/payment-outcomes";
import { calculateBookingCost, BookingUnavailableError } from "@/lib/booking";
import { toNationalNumber } from "@/lib/phone";

// ============================================================================
// Requests a WiPay hosted payment page for a pending booking and returns its
// URL for the browser to redirect to (S5 Payment -> WiPay hosted checkout).
//
// This is the counterpart to /api/payment/callback: initiate sends the
// customer out to WiPay, callback receives them back.
// ============================================================================

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bookingRef } = body as { bookingRef?: string };

  if (!bookingRef) {
    return NextResponse.json({ error: "bookingRef is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { customer: true, vehicle: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.bookingStatus === "CONFIRMED") {
    return NextResponse.json(
      { error: "This booking has already been paid for." },
      { status: 409 }
    );
  }

  if (booking.bookingStatus === "CANCELLED") {
    return NextResponse.json(
      { error: "This booking has been cancelled and can no longer be paid." },
      { status: 409 }
    );
  }

  // Outcome 4 check: refuse to send the customer to a payment page for a
  // booking whose 10-minute hold has already lapsed. Taking payment for a
  // reservation we can no longer guarantee would be worse than making them
  // start again.
  if (isHoldExpired(booking)) {
    await prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: { bookingStatus: HOLD_EXPIRED_OUTCOME.bookingStatus },
    });
    return NextResponse.json(
      { error: HOLD_EXPIRED_OUTCOME.customerMessage },
      { status: 409 }
    );
  }

  // Re-run the A-01 availability check server-side immediately before payment.
  // The Pseudocode for A-01 specifies exactly this: a "secondary server-side
  // check right before redirecting the user to the WiPay payment gateway".
  // Between S4 and S5 another customer may have taken the same vehicle.
  try {
    await calculateBookingCost(
      booking.vehicleId,
      booking.pickupDate,
      booking.returnDate
    );
  } catch (err) {
    if (err instanceof BookingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  // Full prepayment: the entire rental is charged online at booking, which
  // removes the partial-deposit reconciliation the earlier model required.
  const amountDueNow = Number(booking.totalCost);

  try {
    const result = await createWiPayPaymentRequest({
      orderId: booking.bookingRef,
      total: amountDueNow,
      responseUrl: `${(
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      ).replace(/\/$/, "")}/api/payment/callback`,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      customerEmail: booking.customer.email,
      // WiPay's checkout page shows its own country selector alongside the
      // phone field. Sending the full E.164 value (dial code included)
      // duplicates it visibly — see lib/phone.ts toNationalNumber() for the
      // real transaction this was diagnosed against.
      customerPhone: toNationalNumber(booking.customer.phone),
    });

    return NextResponse.json({
      url: result.url,
      transactionId: result.transactionId,
      amountDueNow,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[A-02] WiPay payment request failed:", detail);

    // In development, surface WiPay's actual rejection reason to the browser.
    // Swallowing it behind a generic message makes sandbox setup problems
    // (bad account number, malformed order_id, unsupported currency) almost
    // impossible to diagnose from the UI. In production the customer sees
    // only the generic message — the detail stays in the server logs.
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: isDev
          ? `Payment gateway error: ${detail}`
          : "We could not reach the payment gateway. Please try again in a moment.",
      },
      { status: 502 }
    );
  }
}
