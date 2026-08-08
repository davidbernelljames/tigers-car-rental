"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signInSchema, signUpSchema } from "@/lib/validations/booking";

export function CustomerAuthForm({ onSuccess }: { onSuccess: () => void }) {
  const supabase = createClient();
  const [mode, setMode] = React.useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [signUpSent, setSignUpSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate before calling Supabase. Password strength rules apply to
    // sign-up only — an existing customer must still be able to sign in with
    // a password that predates the current rules.
    const schema = mode === "signIn" ? signInSchema : signUpSchema;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }

    setLoading(true);

    const { error: authError } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          })
        : await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
          });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "signUp") {
      // Email confirmation is required, so the account isn't usable yet —
      // show that plainly instead of calling onSuccess() as if signed in.
      setSignUpSent(true);
      return;
    }

    onSuccess();
  }

  if (signUpSent) {
    return (
      <Card className="max-w-sm mx-auto">
        <CardContent className="pt-6 text-center">
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            Confirmation Email Sent
          </h2>
          <p className="text-sm text-neutral-500">
            Check your inbox and click the confirmation link to activate your
            account, then come back here to sign in.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-sm mx-auto">
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">
          {mode === "signIn" ? "Sign In" : "Create Account"}
        </h2>
        <p className="text-sm text-neutral-500 mb-5">
          {mode === "signIn"
            ? "Sign in to view your bookings and account details."
            : "Create an account to track your bookings."}
        </p>

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
          <div>
            <Label htmlFor="password" required>Password</Label>
            <PasswordInput
              id="password"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === "signUp" && (
              <p className="text-xs text-neutral-400 mt-1">
                At least 10 characters, with a lowercase letter, an uppercase
                letter, a number, and a symbol.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-status-maintenance">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signIn" ? "Sign In" : "Create Account"}
          </Button>

          {mode === "signIn" && (
            <a
              href="/auth/forgot-password?from=customer"
              className="block text-center text-xs text-neutral-400 mt-2 hover:underline"
            >
              Forgot your password?
            </a>
          )}
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          className="mt-4 text-sm text-customer hover:underline w-full text-center"
        >
          {mode === "signIn"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </button>

        {mode === "signIn" && (
          <p className="mt-3 text-xs text-neutral-400 text-center">
            Booked without an account?{" "}
            <a href="/booking/find" className="text-customer hover:underline">
              Find your booking
            </a>{" "}
            instead.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
