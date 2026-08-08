import { createClient } from "@supabase/supabase-js";

// Service-role client — SERVER-SIDE ONLY. Uses the secret key and bypasses
// all RLS, for operations with no user session to authorise against (e.g.
// uploading a generated PDF from inside the WiPay callback). Never import
// this into a Client Component — the missing NEXT_PUBLIC_ prefix means it'd
// just be undefined at runtime rather than leak, but the import is still a
// mistake worth catching in review.

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
