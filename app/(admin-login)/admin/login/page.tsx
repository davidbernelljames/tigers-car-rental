"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { CricketSpinner } from "@/components/ui/cricket-spinner";

// A1: Admin Login. Authentication is handled by Supabase Auth; the role check
// that decides which portal the user lands in happens in middleware.ts, which
// reads the users table. This page deliberately does not attempt its own role
// lookup — duplicating that logic client-side would create a second source of
// truth that could drift from the middleware's.
function AdminLoginContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const nextPath = searchParams.get("next");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      // Deliberately generic: distinguishing "no such account" from "wrong
      // password" would confirm which staff email addresses exist.
      setError("Incorrect email or password.");
      return;
    }

    // [Corrected] A soft, client-side router.push() here occasionally raced
    // the just-set auth cookie against the RSC fetch for the target route —
    // intermittently landing on a 404 or a stale page immediately after
    // sign-in, resolved by a manual refresh. That's a known category of
    // desync between Next.js's middleware, server components, and client
    // components right after an auth state change, not something this one
    // call site can fully rule out on its own, but a hard navigation avoids
    // it in practice: it forces a genuine top-level request carrying the
    // newly written cookies, so middleware sees a fully consistent session
    // on the very first load rather than a client-side navigation that may
    // not.
    window.location.href = nextPath || "/admin/dashboard";
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-admin via-admin to-admin-light flex items-center justify-center px-4 py-16">
      {/* Logo watermark — same gradient treatment as the customer hero
          section (S1), so the login screen reads as part of the same site
          rather than a separate, differently-branded space. */}
      <img
        src="/tiger-logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-16 -bottom-16 h-96 w-96 opacity-[0.06]"
      />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 mb-3">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Staff</h1>
          <p className="text-sm text-white/60 mt-1">
            Tiger&apos;s Car Rental
            <span className="block text-xs text-white/40 mt-0.5">
              (Portal for Management)
            </span>
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" required>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  maxLength={100}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" required>
                  Password
                </Label>
                <PasswordInput
                  id="password"
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-status-maintenance">{error}</p>
              )}

              <Button
                type="submit"
                variant="admin"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign In"}
              </Button>

              <a
                href="/auth/forgot-password?from=admin"
                className="block text-center text-xs text-black/60 mt-2 hover:underline"
              >
                Forgot your password?
              </a>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/40 mt-6">
          Customer bookings are managed at{" "}
          <a href="/account" className="underline">
            My Account
          </a>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-admin via-admin to-admin-light flex flex-col items-center justify-center gap-2">
          <CricketSpinner />
          <p className="text-sm text-white/60">Loading…</p>
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
