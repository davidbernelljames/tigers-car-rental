import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { resolveCustomer } from "@/lib/customer-identity";

// ============================================================================
// Generates a temporary signed URL for a customer's rental agreement PDF and
// redirects the browser to it.
//
// The `rental-agreements` Storage bucket is deliberately private (it contains
// real government ID numbers), so there is no plain public URL to link to —
// RLS (see supabase/rls-policies.sql) already scopes read access to the
// owning customer for authenticated Supabase Storage API calls, but a
// straightforward <a href> can't carry a Supabase session token the way
// storage.download() can. A signed URL is the standard way to hand a
// plain, shareable link to a private object for a limited time.
//
// SECURITY NOTE — a real tradeoff, not an oversight:
// A customer can complete a booking as a guest, with no account, and needs to
// reach their agreement immediately from the S6 Confirmation screen right
// after paying. That screen is only ever reachable via bookingRef in the
// URL, with no session requirement — same as most e-commerce order
// confirmation pages. This endpoint mirrors that: if no session matches the
// booking's customer, it still issues a signed URL rather than blocking
// access entirely, but keeps the window short (10 minutes) to limit
// exposure if a bookingRef leaked or was guessed. Where a real session DOES
// match the booking's customer (the normal case from My Account), that
// stronger, verified path is preferred and logged as such.
//
// Sequential booking refs (TCR-0001, TCR-0002, ...) are guessable by
// enumeration. If this were going into real production with real customer
// ID numbers at stake, the stronger fix would be switching bookingRef to a
// non-sequential public identifier (e.g. a UUID or random slug) for anything
// used in a URL, while keeping a human-friendly sequential number for
// internal/admin display only. Flagging this rather than quietly leaving it,
// since it's a real decision for a production system, not a solved problem.
// ============================================================================

export const dynamic = "force-dynamic";

const GUEST_ACCESS_EXPIRY_SECONDS = 10 * 60; // 10 minutes
const AUTHENTICATED_ACCESS_EXPIRY_SECONDS = 60 * 60; // 1 hour

export async function GET(request: NextRequest) {
  const bookingRef = request.nextUrl.searchParams.get("ref");

  if (!bookingRef) {
    return NextResponse.json({ error: "ref query param is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { rentalAgreement: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!booking.rentalAgreement || !booking.rentalAgreement.filePath) {
    return NextResponse.json(
      {
        error:
          "The rental agreement for this booking hasn't been generated yet. If you just completed payment, please try again shortly.",
      },
      { status: 404 }
    );
  }

  // Check for a real, verified session matching this booking's customer —
  // the stronger path, used whenever available (e.g. from My Account).
  let expirySeconds = GUEST_ACCESS_EXPIRY_SECONDS;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const customer = await resolveCustomer({ id: user.id, email: user.email });
      if (customer && customer.customerId === booking.customerId) {
        expirySeconds = AUTHENTICATED_ACCESS_EXPIRY_SECONDS;
      }
    }
  } catch {
    // No session, or resolution failed — falls through to guest-level access.
  }

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.storage
    .from("rental-agreements")
    .createSignedUrl(booking.rentalAgreement.filePath, expirySeconds, {
      download: `Rental-Agreement-${booking.bookingRef}.pdf`,
    });

  if (error || !data?.signedUrl) {
    console.error(
      `[agreement-download] Failed to sign URL for ${bookingRef}:`,
      error?.message
    );
    return NextResponse.json(
      { error: "Could not generate a download link right now. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
