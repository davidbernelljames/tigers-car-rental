"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CricketSpinner } from "@/components/ui/cricket-spinner";
import { formatVehicleWithDetails } from "@/lib/utils";

interface BookingLookup {
  bookingRef: string;
  status: string;
  pickupDate: string;
  returnDate: string;
  totalCost: number;
  amountPaid: number;
  vehicle: { make: string; model: string; color: string; registrationNumber: string | null };
}

function BookingPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingRef = searchParams.get("bookingRef");

  const [booking, setBooking] = React.useState<BookingLookup | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [redirecting, setRedirecting] = React.useState(false);
  // Populated when the WiPay callback bounced the customer back here with a
  // decline or timeout (Decision Table outcomes 2 and 3).
  const [error, setError] = React.useState<string | null>(
    searchParams.get("error"),
  );

  React.useEffect(() => {
    if (!bookingRef) {
      setLoading(false);
      return;
    }
    fetch(`/api/booking/lookup?ref=${bookingRef}`)
      .then((res) => res.json())
      .then((data) => setBooking(data))
      .finally(() => setLoading(false));
  }, [bookingRef]);

  async function handleProceedToWiPay() {
    setRedirecting(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingRef }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(
          data.error ?? "Could not start the payment. Please try again.",
        );
        setRedirecting(false);
        return;
      }

      // Hand the browser over to WiPay's hosted page. The customer returns to
      // /api/payment/callback, which resolves the outcome and redirects them on.
      window.location.href = data.url;
    } catch {
      setError("Could not reach the payment gateway. Please try again.");
      setRedirecting(false);
    }
  }

  if (!bookingRef) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-neutral-600">
          No booking reference found. Please start again.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <CricketSpinner label="Loading your booking…" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-neutral-600">Booking not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <BookingStepper currentStep={3} />

      <Card>
        <CardContent className="pt-6 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-status-maintenance">
              {error}
            </div>
          )}

          <div>
            <p className="font-semibold text-neutral-900">
              {formatVehicleWithDetails(booking.vehicle)}
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              {new Date(booking.pickupDate).toLocaleDateString()} to{" "}
              {new Date(booking.returnDate).toLocaleDateString()}
            </p>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <div className="flex justify-between text-lg font-bold text-neutral-900">
              <span>Total Due Now</span>
              <span>TT${booking.totalCost.toFixed(2)}</span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              Your rental is paid in full online. Nothing further is due at
              pickup.
            </p>
          </div>

          <div className="rounded-md bg-neutral-50 border border-neutral-200 p-4 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-status-available shrink-0" />
            <p className="text-sm text-neutral-600">
              You will be redirected to WiPay&apos;s hosted payment page. No
              card details are entered or stored on this site.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              ← Back
            </Button>
            <Button onClick={handleProceedToWiPay} disabled={redirecting}>
              <Lock className="h-4 w-4" />
              {redirecting ? "Redirecting…" : "Proceed to WiPay →"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BookingPaymentPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <CricketSpinner label="Loading…" />
        </div>
      }
    >
      <BookingPaymentContent />
    </React.Suspense>
  );
}
