import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCallbackHash, type WiPayCallbackParams } from "@/lib/wipay";
import {
  resolvePaymentOutcome,
  isHoldExpired,
  HOLD_EXPIRED_OUTCOME,
} from "@/lib/payment-outcomes";
import { regenerateRentalAgreement, businessInfoDefaults } from "@/lib/issue-agreement";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { formatVehicleWithDetails } from "@/lib/utils";

// ============================================================================
// Algorithm A-02: WiPay Payment Callback Handler
// Implements all six SS1 Decision Table (6.5) outcomes.
//
// TRANSPORT NOTE: WiPay delivers this as a GET web-redirect with the response
// parameters in the querystring — the customer's own browser is what arrives
// here, which is why every path ends in a redirect rather than a JSON body.
// The Pseudocode document describes A-02 as WiPay "posting" a callback; the
// official WiPay API v1.0.8 documentation specifies a GET redirect to the
// response_url. A POST handler is also exported below so that a
// server-to-server POST, if WiPay ever sends one, is not silently dropped.
// This transport detail should be corrected in the Phase 7 pseudocode
// revision.
// ============================================================================

export const dynamic = "force-dynamic";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Builds the customer-facing redirect for a resolved outcome. */
function outcomeRedirect(
  redirectTo: "confirmation" | "payment" | "vehicles",
  bookingRef: string,
  message: string
): string {
  const msg = encodeURIComponent(message);
  switch (redirectTo) {
    case "confirmation":
      return appUrl(`/booking/confirmation?bookingRef=${bookingRef}`);
    case "payment":
      return appUrl(`/booking/payment?bookingRef=${bookingRef}&error=${msg}`);
    case "vehicles":
      return appUrl(`/vehicles?notice=${msg}`);
  }
}

async function handleCallback(params: WiPayCallbackParams): Promise<NextResponse> {
  const bookingRef = params.order_id;

  // --- Step 1: identify the booking ---
  if (!bookingRef) {
    return NextResponse.redirect(
      appUrl(
        `/vehicles?notice=${encodeURIComponent(
          "We could not match that payment to a booking. Please contact us if you were charged."
        )}`
      )
    );
  }

  // --- Step 2: verify the callback is genuinely from WiPay ---
  // Done before any database write. A forged success callback is the attack
  // worth defending against: it would confirm a booking that was never paid
  // for. Note that verifyCallbackHash deliberately permits a missing hash on
  // non-success callbacks, because WiPay only sends the hash on success.
  const verification = verifyCallbackHash(params);
  if (!verification.valid) {
    console.error(
      `[A-02] Rejected callback for ${bookingRef}: ${verification.reason}`
    );
    return NextResponse.redirect(
      outcomeRedirect(
        "payment",
        bookingRef,
        "We could not verify that payment response. Please try again or contact us."
      )
    );
  }

  // --- Step 3: retrieve the booking ---
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { customer: true, vehicle: true, rentalAgreement: true },
  });

  if (!booking) {
    console.error(`[A-02] No booking found for ref ${bookingRef}`);
    return NextResponse.redirect(
      outcomeRedirect(
        "vehicles",
        bookingRef,
        "We could not find that booking. Please contact us if you were charged."
      )
    );
  }

  // Idempotency: WiPay may redirect more than once (customer refresh, back
  // button). If the booking is already confirmed, do not re-run PDF
  // generation or re-send the confirmation email — just show the result.
  if (booking.bookingStatus === "CONFIRMED") {
    return NextResponse.redirect(
      outcomeRedirect("confirmation", bookingRef, "")
    );
  }

  // --- Outcome 4: the 10-minute hold lapsed before this callback arrived ---
  // Checked before evaluating the payment result: if the reservation window
  // has already expired the vehicle may have been offered to someone else,
  // so we must not confirm it now even on a successful authorisation. A
  // successful payment against an expired hold is refundable by the owner,
  // whereas double-allocating a vehicle is not recoverable.
  if (isHoldExpired(booking)) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { bookingId: booking.bookingId },
        data: { bookingStatus: HOLD_EXPIRED_OUTCOME.bookingStatus },
      }),
      prisma.paymentTransaction.create({
        data: {
          bookingId: booking.bookingId,
          amount: Number(params.total ?? booking.totalCost),
          gatewayRef: params.transaction_id ?? "hold-expired",
          status: HOLD_EXPIRED_OUTCOME.transactionStatus,
        },
      }),
    ]);

    console.warn(
      `[A-02] Outcome 4 (hold expired) for ${bookingRef}; ` +
        `wipay status was "${params.status}"`
    );

    return NextResponse.redirect(
      outcomeRedirect(
        HOLD_EXPIRED_OUTCOME.redirectTo,
        bookingRef,
        params.status?.toLowerCase() === "success"
          ? "Your reservation window expired before payment completed. If you were charged, please contact us for a refund."
          : HOLD_EXPIRED_OUTCOME.customerMessage
      )
    );
  }

  // --- Step 4: resolve which Decision Table outcome this is ---
  // Prior attempts are what distinguish outcomes 5/6 (retries) from 1/2.
  const priorAttempts = await prisma.paymentTransaction.count({
    where: { bookingId: booking.bookingId },
  });

  const outcome = resolvePaymentOutcome(
    params.status,
    params.message,
    priorAttempts
  );

  // --- Step 5: persist the transaction and booking status atomically ---
  // Deposit is only credited on an authorised payment. WiPay's `total` is the
  // authoritative amount charged (it can differ from our total under some fee
  // structures), so we record what was actually taken.
  const amountCharged = Number(params.total ?? booking.totalCost);

  await prisma.$transaction([
    prisma.paymentTransaction.create({
      data: {
        bookingId: booking.bookingId,
        amount: amountCharged,
        gatewayRef: params.transaction_id ?? "unknown",
        status: outcome.transactionStatus,
      },
    }),
    prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: {
        bookingStatus: outcome.bookingStatus,
        ...(outcome.issueAgreement ? { amountPaid: amountCharged } : {}),
      },
    }),
  ]);

  console.info(
    `[A-02] ${bookingRef}: outcome ${outcome.outcomeNumber} (${outcome.outcome}), ` +
      `booking -> ${outcome.bookingStatus}`
  );

  // --- Steps 6-8: agreement PDF + confirmation email (outcomes 1 and 5) ---
  // Everything past this point is a side effect of a payment that has already
  // succeeded. None of it is allowed to fail the request: the money is taken
  // and the booking is confirmed, so a PDF or email problem is logged and
  // surfaced to the admin later, never converted into a customer-facing
  // payment error.
  if (outcome.issueAgreement) {
    await issueAgreementAndEmail(booking.bookingId, params.transaction_id ?? "");
  }

  return NextResponse.redirect(
    outcomeRedirect(outcome.redirectTo, bookingRef, outcome.customerMessage)
  );
}

/**
 * Generates the rental agreement PDF, uploads it to Supabase Storage, records
 * it against the booking, and sends the T-01 confirmation email.
 *
 * Failures are recorded as AgreementStatus.PENDING_RETRY rather than thrown,
 * so an admin can see which confirmed bookings are missing paperwork.
 */
async function issueAgreementAndEmail(
  bookingId: number,
  transactionRef: string
): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingId },
      include: { customer: true, vehicle: true },
    });
    if (!booking) return;

    // PDF generation, Storage upload, and RentalAgreement record are now
    // shared logic — see lib/issue-agreement.ts. Extracted so Algorithm
    // A-05 (Rental Extension Request) can regenerate the same agreement
    // after an extension is paid for, without duplicating this logic.
    const pdfBuffer = await regenerateRentalAgreement(bookingId, transactionRef);
    const { businessName, businessPhone, businessAddress } = await businessInfoDefaults();

    // --- T-01 confirmation email ---
    const emailResult = await sendBookingConfirmationEmail({
      to: booking.customer.email,
      customerName: booking.customer.firstName,
      bookingRef: booking.bookingRef,
      vehicleDescription: formatVehicleWithDetails(booking.vehicle),
      pickupDate: booking.pickupDate.toLocaleDateString("en-GB"),
      returnDate: booking.returnDate.toLocaleDateString("en-GB"),
      totalCost: Number(booking.totalCost),
      amountPaid: Number(booking.amountPaid),
      businessName,
      businessPhone,
      businessAddress,
      agreementPdf: pdfBuffer,
    });

    if (!emailResult.sent) {
      console.error(
        `[A-02] T-01 email not sent for ${booking.bookingRef}: ${emailResult.reason}`
      );
    }
  } catch (err) {
    console.error(`[A-02] Post-payment processing failed:`, err);
  }
}

/** WiPay's documented transport: GET web-redirect with querystring params. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: WiPayCallbackParams = {
    status: sp.get("status") ?? undefined,
    order_id: sp.get("order_id") ?? undefined,
    transaction_id: sp.get("transaction_id") ?? undefined,
    total: sp.get("total") ?? undefined,
    hash: sp.get("hash") ?? undefined,
    message: sp.get("message") ?? undefined,
    card: sp.get("card") ?? undefined,
    currency: sp.get("currency") ?? undefined,
    date: sp.get("date") ?? undefined,
    customer_name: sp.get("customer_name") ?? undefined,
    customer_email: sp.get("customer_email") ?? undefined,
    customer_phone: sp.get("customer_phone") ?? undefined,
  };
  return handleCallback(params);
}

/**
 * Defensive POST handler. WiPay v1.0.8 documents a GET redirect, but accepting
 * a form-encoded or JSON POST costs little and means a server-to-server
 * callback would not be silently lost.
 */
export async function POST(request: NextRequest) {
  let params: WiPayCallbackParams = {};
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      params = (await request.json()) as WiPayCallbackParams;
    } else {
      const form = await request.formData();
      params = Object.fromEntries(
        Array.from(form.entries()).map(([k, v]) => [k, String(v)])
      ) as WiPayCallbackParams;
    }
  } catch {
    // Fall through with empty params — handled as an unmatched callback.
  }

  return handleCallback(params);
}
