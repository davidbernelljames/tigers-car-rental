import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { User, UserRole } from "@prisma/client";

// ============================================================================
// Resolves the signed-in Supabase Auth user to their staff User record
// (OWNER_ADMIN / STAFF_AGENT).
//
// middleware.ts already gates which ROUTES a role can reach. This is the
// second half of that: individual data-mutating actions (creating a vehicle,
// cancelling a booking as staff, editing settings) need their own check,
// because a Server Action or API route can be called directly, and because
// "can view this page" and "can perform this specific action" are not always
// the same permission (a STAFF_AGENT can view bookings but not settings, for
// instance, even though both sit under /admin).
// ============================================================================

export interface StaffSession {
  user: User;
  role: UserRole;
}

/** Returns the signed-in staff user, or null if not signed in or not staff. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const staffUser = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
  });

  if (!staffUser) return null;

  return { user: staffUser, role: staffUser.role };
}

/**
 * Requires the signed-in user to hold one of the given roles, throwing a
 * StaffAuthError (with an HTTP status attached) if not. Intended for API
 * routes and Server Actions — pages themselves are already gated by
 * middleware, so this is the check for mutations specifically.
 */
export class StaffAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireStaffRole(
  allowedRoles: UserRole[]
): Promise<StaffSession> {
  const session = await getStaffSession();

  if (!session) {
    throw new StaffAuthError("Not signed in.", 401);
  }
  if (!allowedRoles.includes(session.role)) {
    throw new StaffAuthError(
      "You do not have permission to perform this action.",
      403
    );
  }
  return session;
}

/** Convenience: any staff role at all. */
export const ANY_STAFF: UserRole[] = ["OWNER_ADMIN", "STAFF_AGENT"];

/** Roles permitted to modify operational data — bookings, fleet, maintenance. */
export const OPERATIONAL_STAFF: UserRole[] = ["OWNER_ADMIN", "STAFF_AGENT"];

/** Owner only — financials, settings, promotions, staff management. */
export const OWNER_ONLY: UserRole[] = ["OWNER_ADMIN"];
