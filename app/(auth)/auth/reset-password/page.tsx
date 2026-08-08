"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validations/booking";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { CustomerHeader } from "@/components/layout/customer-header";
import { CustomerFooter } from "@/components/layout/customer-footer";

// ============================================================================
// Destination of the link Supabase emails when resetPasswordForEmail() is
// called from /auth/forgot-password. Shared between customer and admin for
// the same reason that page is shared — see the comment there.
//
// [Corrected] Same fix as forgot-password: the customer branch now renders
// the real CustomerHeader/CustomerFooter directly, rather than a bare
// centered card with no site chrome at all.
//
// Supabase's browser client (createBrowserClient, with its default
// detectSessionInUrl: true) automatically parses the recovery token this
// page is loaded with and fires a PASSWORD_RECOVERY auth event once it's
// verified — that event is the actual signal a legitimate reset link
// brought the user here, not just the page having loaded at all. Listening
// for it rather than assuming the link is valid the moment the page mounts
// means an expired or already-used link correctly leaves the "set a new
// password" form hidden rather than shown and then failing on submit.
// ============================================================================

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") === "admin" ? "admin" : "customer";

  const [ready, setReady] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Password does not meet the requirements.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  const signInHref = from === "admin" ? "/admin/login" : "/account";

  React.useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.push(signInHref), 2500);
      return () => clearTimeout(t);
    }
  }, [done, router, signInHref]);

  const formCard = (
    <>
      <Card>
        <CardContent className="pt-6">
          {done ? (
            <div className="text-center py-2">
              <CheckCircle2 className="h-8 w-8 text-status-available mx-auto mb-2" />
              <p className="text-sm text-neutral-700">
                Your password has been updated. Redirecting you to sign in…
              </p>
            </div>
          ) : !ready ? (
            <p className="text-sm text-neutral-500 text-center py-4">
              Verifying your reset link…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" required>New Password</Label>
                <PasswordInput
                  id="password"
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-neutral-400 mt-1">
                  At least 10 characters, with a lowercase letter, an
                  uppercase letter, a number, and a symbol.
                </p>
              </div>
              <div>
                <Label htmlFor="confirmPassword" required>Confirm New Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  maxLength={72}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-status-maintenance">{error}</p>}
              <Button type="submit" variant={from === "admin" ? "admin" : "default"} className="w-full" disabled={submitting}>
                {submitting ? "Saving…" : "Set New Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {!ready && !done && (
        <p className={from === "admin" ? "text-center text-xs text-white/40 mt-4" : "text-center text-xs text-neutral-400 mt-4"}>
          If this doesn&apos;t update within a few seconds, your reset link
          may have expired.{" "}
          <a href={`/auth/forgot-password?from=${from}`} className="underline">
            Request a new one
          </a>
          .
        </p>
      )}
    </>
  );

  if (from === "customer") {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <CustomerHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-customer/10 mb-3">
                <KeyRound className="h-5 w-5 text-customer" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900">Set New Password</h1>
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
          <h1 className="text-xl font-bold text-white">Set New Password</h1>
        </div>
        {formCard}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
