import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

// Used in Server Components and Route Handlers (e.g. admin RBAC checks,
// A-02 WiPay callback booking lookups). Reads/writes the Supabase Auth
// session via Next.js cookies, per SIP Section 2.3's two-layer RBAC model
// (this file implements the route/session layer; Supabase RLS policies
// implement the database layer).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if middleware
            // is also refreshing the session.
          }
        },
      },
    }
  );
}
