import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ============================================================================
// Route-layer RBAC — first of the two enforcement layers required by SIP
// Section 2.3. The second layer is Supabase Row Level Security, applied in
// supabase/rls-policies.sql.
//
// Why two layers: middleware protects *pages*, RLS protects *data*. Middleware
// alone would leave the database open to any request that bypasses the Next.js
// route (a direct PostgREST call with the anon key, for instance). RLS alone
// would leave admin pages rendering their shell to unauthorised users before
// the data query failed. Neither is sufficient by itself.
//
// Role model (schema User.role):
//   OWNER_ADMIN — full access to A1-A9
//   STAFF_AGENT — "Admin Assistant" per SS1 Stakeholder Register; operational screens only; no financials, no settings
// ============================================================================

/**
 * Admin routes that OWNER_ADMIN alone may access.
 *
 * Staff are deliberately excluded from reports (A6), promotions (A7),
 * settings (A9), customer records (A5) and staff management: these expose
 * revenue figures, discount control, system configuration and personal data.
 * The SS1 role definition for STAFF_AGENT is explicit that it carries
 * "no financials or settings".
 *
 * [Corrected] /admin/dashboard was missing from this list entirely — the
 * comment in the login page claiming "middleware resolves the role and
 * redirects to the correct portal home" was aspirational, not actually
 * true for this one route. A staff sign-in landed on the owner's dashboard,
 * complete real revenue figures, and stayed there indefinitely; nothing
 * ever redirected them away unless they manually clicked elsewhere, and
 * the browser back button returned them to it just as freely. Every other
 * financially sensitive page was already correctly protected — this was
 * the one gap in an otherwise consistent list.
 */
const OWNER_ONLY_PREFIXES = [
  "/admin/dashboard",
  "/admin/reports",
  "/admin/promotions",
  "/admin/settings",
  "/admin/staff-management",
  "/admin/customers",
];

/** Where each role belongs when it lands somewhere it should not be. */
const ROLE_HOME: Record<string, string> = {
  OWNER_ADMIN: "/admin/dashboard",
  STAFF_AGENT: "/admin/staff",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The Supabase SSR client needs to write refreshed auth cookies onto the
  // response, so the response object is created first and passed in.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // getUser() revalidates the JWT against Supabase rather than trusting the
  // cookie's contents. getSession() would be faster but returns whatever the
  // cookie claims, which is the wrong trade-off for an access check.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- /account: the page itself renders a sign-in form for guests ---
  if (pathname.startsWith("/account")) {
    return response;
  }

  const isAdminRoute = pathname.startsWith("/admin");

  if (!isAdminRoute) {
    return response;
  }

  // The admin login page must stay reachable without a session, or there is
  // no way to acquire one.
  if (pathname === "/admin/login") {
    if (user) {
      const role = await getUserRole(supabase, user.id);
      if (role) {
        return NextResponse.redirect(
          new URL(ROLE_HOME[role] ?? "/admin/dashboard", request.url)
        );
      }
    }
    return response;
  }

  // --- Unauthenticated: send to login with a return path ---
  if (!user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Authenticated but not a staff/admin user ---
  // A signed-in *customer* hitting /admin is misdirected, not an attacker;
  // send them to their own account area rather than a bare 403.
  const role = await getUserRole(supabase, user.id);
  if (!role) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  // --- Admin portal ---
  if (role === "STAFF_AGENT") {
    const isOwnerOnly = OWNER_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
    if (isOwnerOnly) {
      const denied = new URL("/admin/staff", request.url);
      denied.searchParams.set("denied", "1");
      return NextResponse.redirect(denied);
    }
  }

  return response;
}

/**
 * Looks up the caller's role from the users table.
 *
 * This deliberately queries the database rather than reading a role claim from
 * the JWT: a role stored in app_metadata would be stale until the token
 * refreshed, so revoking someone's access would not take effect immediately.
 * Correctness matters more than the round trip here.
 *
 * Returns null for authenticated users with no staff record — i.e. customers.
 */
async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  authUserId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    // A real RLS/auth error here must be visible in the server log — not
    // silently treated the same as "this person just has no staff role".
    console.error("[middleware] getUserRole query failed:", {
      authUserId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }
  if (!data) return null;

  return (data as { role: string }).role;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
