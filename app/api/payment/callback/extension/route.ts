import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCallbackHash, type WiPayCallbackParams } from "@/lib/wipay";
import { regenerateRentalAgreement, businessInfoDefaults } from "@/lib/issue-agreement";
import { sendExtensionConfirmationEmail } from "@/lib/email";
import { formatVehicleWithDetails } from "@/lib/utils";

// ============================================================================
// Algorithm A-05 — Step 3, Payment Callback.
//
// [Corrected] Previously redirected back to /admin/bookings on every
// outcome — a leftover from when an ADMIN followed this link themselves.
// Now that payment is the CUSTOMER's own step (initiated from
// /api/booking/extension-payment), this redirects to Find My Booking
// instead, the same page the customer was already using to manage their
// booking without an account.
//
// Same transport and MD5 verification as Algorithm A-02, applied to a
// narrower outcome: an extension payment either succeeds or it does not —
// no Pending-hold or retry-then-cancel sequence to model, since the
// original booking is already Confirmed regardless of how this resolves.
// ============================================================================

export const dynamic = "force-dynamic";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Extracts the original BookingRef from an extension order_id of the form "{ref}-EXT-{timestamp}". */
function bookingRefFromExtensionOrderId(orderId: string): string | null {
  const match = orderId.match(/^(.+)-EXT-\d+$/);
  return match ? match[1] : null;
}

async function handleExtensionCallback(params: WiPayCallbackParams): Promise<NextResponse> {
  const orderId = params.order_id;
  const bookingRef = orderId ? bookingRefFromExtensionOrderId(orderId) : null;

  if (!bookingRef) {
    console.error("[A-05] Extension callback: could not parse booking ref from order_id", orderId);
    return NextResponse.redirect(
      appUrl(`/booking/find?extension=error&message=${encodeURIComponent("Could not identify the booking for this extension payment.")}`)
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { customer: true, vehicle: true },
  });

  if (!booking) {
    console.error(`[A-05] Extension callback: booking ${bookingRef} not found`);
    return NextResponse.redirect(appUrl(`/booking/find?extension=error`));
  }

  // Nothing awaiting payment — either already resolved by an earlier
  // callback, or never approved in the first place. Redirect quietly
  // rather than erroring, matching how the original callback treats an
  // already-Confirmed booking as an idempotent no-op.
  if (booking.extensionStatus !== "APPROVED_AWAITING_PAYMENT" || !booking.extensionCost) {
    return NextResponse.redirect(appUrl(`/booking/find?extension=already-resolved&ref=${bookingRef}`));
  }

  const verification = verifyCallbackHash(params);
  if (!verification.valid) {
    console.error(`[A-05] Rejected extension callback for ${bookingRef}: ${verification.reason}`);
    return NextResponse.redirect(
      appUrl(`/booking/find?extension=error&ref=${bookingRef}&message=${encodeURIComponent("Could not verify the payment response.")}`)
    );
  }

  const isSuccess = params.status?.toLowerCase() === "success";

  if (!isSuccess) {
    console.info(`[A-05] Extension payment not authorised for ${bookingRef}: status=${params.status}`);
    // Leave APPROVED_AWAITING_PAYMENT — the grant is still valid, only this
    // payment attempt failed. The customer can just try paying again.
    return NextResponse.redirect(appUrl(`/booking/find?extension=declined&ref=${bookingRef}`));
  }

  // --- Success: apply the extension ---
  const additionalCost = Number(booking.extensionCost);
  const newReturnDate = booking.extensionRequestedReturnDate!;

  await prisma.$transaction([
    prisma.booking.update({
      where: { bookingId: booking.bookingId },
      data: {
        returnDate: newReturnDate,
        totalCost: Number(booking.totalCost) + additionalCost,
        amountPaid: Number(booking.amountPaid) + additionalCost,
        extensionStatus: "NONE",
        extensionRequestedReturnDate: null,
        extensionCost: null,
        extensionDeclineReason: null,
      },
    }),
    prisma.paymentTransaction.create({
      data: {
        bookingId: booking.bookingId,
        amount: additionalCost,
        gatewayRef: params.transaction_id ?? "unknown",
        status: "AUTHORISED",
      },
    }),
  ]);

  console.info(`[A-05] Extension applied for ${bookingRef}: new return date ${newReturnDate.toISOString()}, +TT$${additionalCost.toFixed(2)}`);

  const pdfBuffer = await regenerateRentalAgreement(booking.bookingId, params.transaction_id ?? "");

  const business = await businessInfoDefaults();
  const additionalDays = Math.max(
    1,
    Math.round((newReturnDate.getTime() - booking.returnDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const emailResult = await sendExtensionConfirmationEmail({
    to: booking.customer.email,
    customerName: booking.customer.firstName,
    bookingRef: booking.bookingRef,
    vehicleDescription: formatVehicleWithDetails(booking.vehicle),
    newReturnDate: newReturnDate.toLocaleDateString("en-GB"),
    additionalDays,
    additionalCost,
    ...business,
  });
  if (!emailResult.sent) {
    console.error(`[A-05] Extension confirmation email not sent for ${bookingRef}: ${emailResult.reason}`);
  }
  void pdfBuffer;

  return NextResponse.redirect(appUrl(`/booking/find?extension=success&ref=${bookingRef}`));
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
  };
  return handleExtensionCallback(params);
}
