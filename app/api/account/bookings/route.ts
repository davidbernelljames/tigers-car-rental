import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveCustomer } from "@/lib/customer-identity";
import { getStaffSession } from "@/lib/staff-auth";

// Returns the signed-in customer's profile and booking history (S7 My Account).
//
// Phase 3: identity now resolves via Customer.authUserId (see
// lib/customer-identity.ts), replacing the Phase 2 email-only match. The
// email path survives only as a one-time claim for guest bookings made
// before the account existed.
//
// [Corrected] Supabase Auth sessions are shared across the whole site — a
// staff member signed into the admin portal is, from this route's point of
// view, just another authenticated user, since there is nothing scoping a
// session to "admin" or "customer" specifically. Without an explicit check,
// a staff member visiting this page would see themselves as a genuinely
// signed-in customer with an empty account, rather than what is actually
// true: staff and customer are separate kinds of identity, and this account
// simply isn't a customer at all. Checking for a staff session first, using
// the same lookup middleware already relies on, surfaces that honestly
// instead of showing a blank, confusing "signed in, no bookings" state.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const staffSession = await getStaffSession();
  if (staffSession) {
    return NextResponse.json({ isStaffAccount: true, customer: null, bookings: [] });
  }

  const customer = await resolveCustomer({ id: user.id, email: user.email });

  if (!customer) {
    return NextResponse.json({ customer: null, bookings: [] });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.customerId },
    include: { vehicle: true, rentalAgreement: true, review: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      drivingPermitNumber: customer.drivingPermitNumber,
    },
    bookings: bookings.map((b) => ({
      bookingRef: b.bookingRef,
      vehicle: `${b.vehicle.make} ${b.vehicle.model}`,
      pickupDate: b.pickupDate,
      returnDate: b.returnDate,
      status: b.bookingStatus,
      hasAgreement: !!b.rentalAgreement,
      hasReview: !!b.review,
      extensionStatus: b.extensionStatus,
      extensionRequestedReturnDate: b.extensionRequestedReturnDate,
      extensionCost: b.extensionCost ? Number(b.extensionCost) : null,
      extensionDeclineReason: b.extensionDeclineReason,
    })),
  });
}
