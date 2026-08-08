import { prisma } from "@/lib/prisma";
import type { Customer } from "@prisma/client";

// ============================================================================
// Resolves an authenticated Supabase user to their Customer record.
//
// Replaces the Phase 2 stopgap that matched purely on email. Email matching
// worked but was the wrong primary key for identity: an email address is a
// mutable attribute, whereas the Supabase Auth UID is the stable identifier
// for "this person's account".
//
// The migration is handled here rather than by a one-off script because the
// two records genuinely can pre-date each other in either order:
//
//   - Guest booking first, account later. /api/booking/create upserts a
//     Customer by email with no auth_user_id, because the person was not
//     signed in. When they later sign up with that same email, this function
//     links the existing record instead of orphaning their booking history.
//
//   - Account first, booking later. The Customer row is created at signup
//     with the auth UID already attached.
//
// The email fallback therefore stays, but only as a one-time claim path: the
// moment it matches, auth_user_id is written and all future lookups use the
// UID directly.
// ============================================================================

export interface AuthUserInfo {
  id: string;
  email?: string;
}

/**
 * Finds the Customer for an authenticated user, linking by auth UID where
 * possible and claiming an unlinked email-matched record where not.
 *
 * Returns null when the user has no Customer record at all — a signed-in
 * person who has never booked, which is a legitimate state, not an error.
 */
export async function resolveCustomer(
  user: AuthUserInfo
): Promise<Customer | null> {
  // Preferred path: already linked.
  const linked = await prisma.customer.findUnique({
    where: { authUserId: user.id },
  });
  if (linked) return linked;

  if (!user.email) return null;

  // Fallback: a guest-booking record exists under this email but was never
  // linked. Claim it.
  const byEmail = await prisma.customer.findUnique({
    where: { email: user.email },
  });

  if (!byEmail) return null;

  // Only claim records that are genuinely unlinked. If the row already
  // carries a *different* auth UID, two accounts are contesting one email —
  // refuse rather than silently reassign someone else's booking history.
  if (byEmail.authUserId && byEmail.authUserId !== user.id) {
    console.error(
      `[identity] Customer ${byEmail.customerId} is linked to a different auth user; refusing to reassign.`
    );
    return null;
  }

  return prisma.customer.update({
    where: { customerId: byEmail.customerId },
    data: { authUserId: user.id },
  });
}

/**
 * Ensures a Customer record exists for a newly signed-up user.
 *
 * Called after signup. Name and phone are left blank when unknown — they get
 * filled in at the next booking, since S4 collects them anyway. Creating the
 * row up front means the account page has something to attach to immediately.
 */
export async function ensureCustomerForUser(
  user: AuthUserInfo,
  details?: { firstName?: string; lastName?: string; phone?: string }
): Promise<Customer | null> {
  if (!user.email) return null;

  const existing = await resolveCustomer(user);
  if (existing) return existing;

  return prisma.customer.create({
    data: {
      authUserId: user.id,
      email: user.email,
      firstName: details?.firstName ?? "",
      lastName: details?.lastName ?? "",
      phone: details?.phone ?? "",
      drivingPermitNumber: "",
    },
  });
}
