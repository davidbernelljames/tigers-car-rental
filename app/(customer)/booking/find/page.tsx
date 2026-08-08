"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExtensionPanel, type ExtensionStatus } from "@/components/booking/extension-panel";
import { CancelPanel } from "@/components/booking/cancel-panel";

// ============================================================================
// S7b Find My Booking — the guest-side counterpart to My Account.
//
// Solves a real gap: a guest who booked without an account has, until now,
// had exactly one way back to their booking after leaving the confirmation
// screen — the confirmation email, which does not exist while
// RESEND_API_KEY is a placeholder. This page requires no account and no
// email delivery at all: enter the booking reference and the email used at
// booking, get the status back and a link to re-download the agreement.
//
// Also the customer-facing home of Algorithm A-05's corrected flow —
// requesting an extension, seeing its review status, and paying once
// approved all happen here (or in My Account, via the same shared
// ExtensionPanel component), never on the admin side.
// ============================================================================

interface FoundBooking {
  bookingRef: string;
  status: string;
  pickupDate: string;
  returnDate: string;
  totalCost: number;
  amountPaid: number;
  vehicleLabel: string;
  agreementPath: string | null;
  extensionStatus: ExtensionStatus;
  extensionRequestedReturnDate: string | null;
  extensionCost: number | null;
  extensionDeclineReason: string | null;
}

const STATUS_VARIANT: Record<
  string,
  "available" | "onRental" | "maintenance" | "neutral"
> = {
  PENDING: "onRental",
  CONFIRMED: "available",
  ON_RENTAL: "onRental",
  COMPLETED: "neutral",
  CANCELLED: "maintenance",
};

const EXTENSION_BANNER: Record<string, string> = {
  success: "Extension confirmed — your new return date is now in effect.",
  declined: "That payment attempt was declined. You can try paying again below.",
  "already-resolved": "This extension has already been processed.",
  error: "Something went wrong processing the extension payment.",
};

function FindBookingContent() {
  const searchParams = useSearchParams();
  const extensionBannerKey = searchParams.get("extension");
  const prefilledRef = searchParams.get("ref") ?? "";

  const [bookingRef, setBookingRef] = React.useState(prefilledRef);
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<FoundBooking | null>(null);

  async function lookup(ref: string, mail: string) {
    setSubmitting(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/booking/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingRef: ref, email: mail }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not find that booking.");
      return;
    }
    setResult(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await lookup(bookingRef, email);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">
        Find My Booking
      </h1>
      <p className="text-neutral-500 text-sm mb-6">
        Enter your booking reference and the email you used to check its
        status, request an extension, or re-download your rental agreement.
        No account required.
      </p>

      {extensionBannerKey && EXTENSION_BANNER[extensionBannerKey] && (
        <div className="mb-4 rounded-md bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
          {EXTENSION_BANNER[extensionBannerKey]} Look up your booking below to see the latest status.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="bookingRef" required>
                Booking Reference
              </Label>
              <Input
                id="bookingRef"
                placeholder="TCR-"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email" required>
                Email
              </Label>
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
            {error && (
              <p className="text-sm text-status-maintenance">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              <Search className="h-4 w-4" />
              {submitting ? "Searching…" : "Find Booking"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-neutral-900">
                {result.bookingRef}
              </p>
              <Badge variant={STATUS_VARIANT[result.status] ?? "neutral"}>
                {result.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-neutral-600">{result.vehicleLabel}</p>
            <p className="text-xs text-neutral-400 mt-1">
              {new Date(result.pickupDate).toLocaleDateString()} –{" "}
              {new Date(result.returnDate).toLocaleDateString()}
            </p>
            <div className="mt-3 pt-3 border-t border-neutral-100 text-sm">
              <p>Total: TT${result.totalCost.toFixed(2)}</p>
              <p>Paid: TT${result.amountPaid.toFixed(2)}</p>
            </div>
            {result.agreementPath && (
              <a
                href={`/api/booking/agreement?ref=${result.bookingRef}`}
                className="mt-4 block"
              >
                <Button variant="outline" className="w-full">
                  Download Rental Agreement
                </Button>
              </a>
            )}
            {result.status === "COMPLETED" && (
              <a href={`/review/${result.bookingRef}`} className="mt-2 block">
                <Button className="w-full">Leave a Review</Button>
              </a>
            )}

            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-start justify-between gap-3">
              <ExtensionPanel
                bookingRef={result.bookingRef}
                email={email}
                bookingStatus={result.status}
                currentReturnDate={result.returnDate}
                extensionStatus={result.extensionStatus}
                extensionRequestedReturnDate={result.extensionRequestedReturnDate}
                extensionCost={result.extensionCost}
                extensionDeclineReason={result.extensionDeclineReason}
                onChanged={() => lookup(result.bookingRef, email)}
              />
              <CancelPanel
                bookingRef={result.bookingRef}
                email={email}
                bookingStatus={result.status}
                onCancelled={() => lookup(result.bookingRef, email)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FindBookingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-14 sm:px-6" />}>
      <FindBookingContent />
    </Suspense>
  );
}
