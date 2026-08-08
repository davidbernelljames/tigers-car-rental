import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWiPayPaymentRequest } from "@/lib/wipay";
import { z } from "zod";

// ============================================================================
// Algorithm A-05 — Step 3, Customer Payment.
//
// This is the corrected location for WiPay contact. Previously, the admin
// route generated this exact link and staff followed it themselves — this
// route exists specifically so the CUSTOMER's own browser is the one that
// reaches WiPay, matching how the original booking payment already works.
// Reachable only once staff have granted the request (extensionStatus =
// APPROVED_AWAITING_PAYMENT) — verified the same way Find My Booking and
// the request route verify identity, by reference + email match.
// ============================================================================

export const dynamic = "force-dynamic";

const paySchema = z.object({
  bookingRef: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: parsed.data.bookingRef.toUpperCase() },
    include: { customer: true },
  });

  if (!booking || booking.customer.email.toLowerCase() !== parsed.data.email) {
    return NextResponse.json(
      { error: "No booking found matching that reference and email." },
      { status: 404 }
    );
  }

  if (booking.extensionStatus !== "APPROVED_AWAITING_PAYMENT" || !booking.extensionCost) {
    return NextResponse.json(
      { error: "There is no approved extension awaiting payment for this booking." },
      { status: 409 }
    );
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const extensionOrderId = `${booking.bookingRef}-EXT-${Date.now()}`;

  try {
    const result = await createWiPayPaymentRequest({
      orderId: extensionOrderId,
      total: Number(booking.extensionCost),
      responseUrl: `${baseUrl}/api/payment/callback/extension`,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      customerEmail: booking.customer.email,
      customerPhone: booking.customer.phone,
    });

    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[A-05] WiPay extension payment request failed:", err);
    return NextResponse.json(
      { error: "Could not reach the payment gateway. Please try again." },
      { status: 502 }
    );
  }
}
