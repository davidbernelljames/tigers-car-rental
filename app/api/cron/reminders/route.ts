import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPickupReminderEmail } from "@/lib/email";
import { formatVehicleWithDetails } from "@/lib/utils";

// ============================================================================
// Algorithm A-03: Automated Booking Reminder (T-02 — Vercel Cron)
// Route: GET /api/cron/reminders
// Schedule: daily at 12:00 UTC (vercel.json)
//
// Sends a pickup reminder at both the 48-hour and 24-hour marks, per the SS1
// specification. A booking naturally receives both: on one day's run it falls
// in the 48-hour window, on the next day's run it falls in the 24-hour one.
//
// AUTH NOTE — a real discrepancy with the approved Pseudocode document:
// SS1's A-03 pseudocode reads the secret from an `x-cron-secret` header.
// Vercel Cron does not send that header — it sends
// `Authorization: Bearer <CRON_SECRET>`. Implementing only what the document
// says would mean every real scheduled invocation is rejected with a 401.
// Both are accepted below, so the documented contract still works for manual
// testing while the actual platform mechanism works in production. The
// document should be corrected to `Authorization: Bearer` during the Phase 7
// pseudocode revision — the same class of correction already flagged there
// for A-02's HMAC-vs-MD5 hash method.
// ============================================================================

export const dynamic = "force-dynamic";

interface DispatchFailure {
  bookingRef: string;
  reason: string;
}

/** Basic sanity check only — SS1 A-03 requires skipping malformed addresses. */
function looksLikeEmail(value: string | null | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request: NextRequest) {
  // --- Step 1: authenticate the cron trigger ---
  const expected = process.env.CRON_SECRET;

  if (expected) {
    const authHeader = request.headers.get("authorization");
    const legacyHeader = request.headers.get("x-cron-secret");
    const authorised =
      authHeader === `Bearer ${expected}` || legacyHeader === expected;

    if (!authorised) {
      console.warn("[T-02] Unauthorised cron invocation attempt");
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  } else {
    // No secret configured. Refusing outright would make the endpoint
    // impossible to test locally before deployment; running it unguarded in
    // production would let anyone trigger a mass email send. Allowed in
    // development only, and loudly logged.
    if (process.env.NODE_ENV === "production") {
      console.error("[T-02] CRON_SECRET is not set — refusing to run in production");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }
    console.warn("[T-02] CRON_SECRET not set — running unauthenticated (dev only)");
  }

  try {
    // --- Step 2: check the A9 notification preference ---
    const settings = await prisma.systemSettings.findFirst();

    if (settings && !settings.reminderNotificationsEnabled) {
      console.info("[T-02] Reminders disabled in System Settings — exiting");
      return NextResponse.json({ dispatched: 0, disabled: true });
    }

    const business = {
      businessName: settings?.businessName ?? "Tiger's Car Rental",
      businessPhone: settings?.businessPhone ?? "",
      businessAddress: settings?.businessAddress ?? "",
    };

    // --- Step 3: calculate the window boundaries ---
    const now = new Date();
    const in24hr = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48hr = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // --- Step 4: bookings picking up within 24 hours ---
    // `reminder24SentAt: null` is what makes re-running this safe.
    const due24 = await prisma.booking.findMany({
      where: {
        bookingStatus: "CONFIRMED",
        pickupDate: { gte: now, lte: in24hr },
        reminder24SentAt: null,
      },
      include: { customer: true, vehicle: true },
    });

    // --- Step 5: bookings picking up in 24-48 hours ---
    const due48 = await prisma.booking.findMany({
      where: {
        bookingStatus: "CONFIRMED",
        pickupDate: { gt: in24hr, lte: in48hr },
        reminder48SentAt: null,
      },
      include: { customer: true, vehicle: true },
    });

    let dispatched = 0;
    let skipped = 0;
    const failures: DispatchFailure[] = [];

    for (const group of [
      { bookings: due24, window: 24 as const },
      { bookings: due48, window: 48 as const },
    ]) {
      for (const booking of group.bookings) {
        // SS1 exception flow: skip malformed addresses, keep processing.
        if (!looksLikeEmail(booking.customer.email)) {
          console.error(
            `[T-02] Skipping ${booking.bookingRef}: invalid customer email`
          );
          skipped++;
          continue;
        }

        // Each send is isolated — SS1 requires that one customer's failure
        // does not abort the remaining reminders.
        const result = await sendPickupReminderEmail({
          to: booking.customer.email,
          customerName: booking.customer.firstName,
          bookingRef: booking.bookingRef,
          vehicleDescription: formatVehicleWithDetails(booking.vehicle),
          pickupDate: booking.pickupDate.toLocaleDateString("en-GB"),
          returnDate: booking.returnDate.toLocaleDateString("en-GB"),
          window: group.window,
          ...business,
        });

        if (!result.sent) {
          console.error(
            `[T-02] ${group.window}hr reminder failed for ${booking.bookingRef}: ${result.reason}`
          );
          failures.push({
            bookingRef: booking.bookingRef,
            reason: result.reason ?? "unknown",
          });
          // Deliberately NOT stamped — leaving it null means the next daily
          // run retries it, rather than silently giving up after one failure.
          continue;
        }

        await prisma.booking.update({
          where: { bookingId: booking.bookingId },
          data:
            group.window === 24
              ? { reminder24SentAt: new Date() }
              : { reminder48SentAt: new Date() },
        });
        dispatched++;
      }
    }

    console.info(
      `[T-02] Reminder run complete - dispatched ${dispatched}, skipped ${skipped}, failed ${failures.length}`
    );

    return NextResponse.json({
      dispatched,
      skipped,
      failed: failures.length,
      failures,
      windows: { due24: due24.length, due48: due48.length },
    });
  } catch (err) {
    // SS1 exception flow: a database failure returns 500 so Vercel retries on
    // the next scheduled cycle.
    console.error("[T-02] Reminder cron failed:", err);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
