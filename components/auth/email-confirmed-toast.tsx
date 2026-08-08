"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

// ============================================================================
// Supabase's email confirmation link redirects to the site's bare Site URL
// (the homepage), carrying a one-time `code` param it uses to establish the
// session — handled automatically by the browser client's own
// detectSessionInUrl setting. What was missing was any VISIBLE feedback that
// this actually succeeded; the person just landed on the homepage with no
// indication anything happened at all.
//
// A `code` param landing specifically on the homepage is a reliable signal
// here: no other flow in this app targets `/` as a redirect destination, so
// its mere presence is enough to show the confirmation, without needing to
// inspect token contents.
// ============================================================================

function EmailConfirmedToastContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("code")) {
      setVisible(true);
      // Clean the URL so refreshing or navigating back doesn't re-show this.
      router.replace("/");
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-neutral-900 text-white px-4 py-2 text-sm shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-status-available" />
      Email confirmed — you can now sign in.
    </div>
  );
}

export function EmailConfirmedToast() {
  return (
    <Suspense fallback={null}>
      <EmailConfirmedToastContent />
    </Suspense>
  );
}
