"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomerHeader } from "@/components/layout/customer-header";
import { CustomerFooter } from "@/components/layout/customer-footer";

// ============================================================================
// Shared password-reset request page, used by BOTH the customer sign-in
// form (S7) and the admin login page (A1). Deliberately one page rather than
// two near-identical copies: Supabase Auth itself does not distinguish a
// "customer" account from a "staff" account — resetting a password is purely
// an Auth-layer operation with no reference to our own role tables at all,
// so there is nothing genuinely different between the two cases beyond
// which screen the person came from and should be sent back to.
//
// [Corrected] The customer branch previously built its own approximation of
// the site's look (a bare centered card, no header, no footer) rather than
// actually using it — which is exactly what made it feel like a separate,
// disconnected utility page instead of part of the same site. It now
// renders the real CustomerHeader and CustomerFooter directly, the same
// components every other customer page uses, rather than an imitation of
// them. The admin branch keeps its own full-screen gradient treatment,
// which already correctly mirrors the real admin login page.
//
// Kept in its own (auth) route group rather than under the customer or
// admin route groups, since only the admin branch actually needs to avoid
// inherited layout (the authenticated sidebar) — but importing the real
// customer components directly, rather than relying on route-group
// inheritance, means one URL can still correctly serve both.
// ============================================================================

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") === "admin" ? "admin" : "customer";

  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const baseUrl = window.location.origin;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${baseUrl}/auth/reset-password?from=${from}` }
    );

    setSubmitting(false);

    // Always show the same success message regardless of whether the email
    // actually matches an account — confirming or denying that an address
    // has an account here would let anyone probe which emails are
    // registered, the same reasoning already applied to sign-in's generic
    // "Incorrect email or password" message.
    if (resetError) {
      console.error("[forgot-password] resetPasswordForEmail failed:", resetError.message);
    }
    setSent(true);
  }

  const backHref = from === "admin" ? "/admin/login" : "/account";
  const backLabel = from === "admin" ? "Back to Staff Sign In" : "Back to Sign In";

  const formCard = (
    <Card>
      <CardContent className="pt-6">
        {sent ? (
          <div className="text-center py-2">
            <p className="text-sm text-neutral-700">
              If an account exists for that email, a password reset link
              has been sent. Check your inbox.
            </p>
            <Link href={backHref} className="text-sm text-customer underline mt-4 inline-block">
              {backLabel}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={100}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-status-maintenance">{error}</p>}
            <Button type="submit" variant={from === "admin" ? "admin" : "default"} className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send Reset Link"}
            </Button>
            <Link
              href={backHref}
              className="block text-center text-xs text-neutral-400 mt-2"
            >
              {backLabel}
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );

  if (from === "customer") {
    // Real site chrome — the same header/footer every other customer page
    // uses, not an approximation of them.
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <CustomerHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-customer/10 mb-3">
                <KeyRound className="h-5 w-5 text-customer" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900">Reset Password</h1>
            </div>
            {formCard}
          </div>
        </main>
        <CustomerFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-admin via-admin to-admin-light flex items-center justify-center px-4 py-16">
      <img
        src="/tiger-logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-16 -bottom-16 h-96 w-96 opacity-[0.06]"
      />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 mb-3">
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Reset Password</h1>
        </div>
        {formCard}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
