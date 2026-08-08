"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

// ============================================================================
// Shared across Find My Booking (guests) and My Account (signed-in
// customers) — mirrors the same pattern already established by
// ExtensionPanel: both contexts verify identity the same way (reference +
// email), so one component covers both rather than two near-duplicates.
//
// Built on top of the existing /api/booking/cancel route, which already
// implemented the full cancellation policy and refund calculation — this
// component is the missing customer-facing surface for logic that was
// previously admin-only in practice, even though the backend supported a
// customer caller correctly.
// ============================================================================

export interface CancelPanelProps {
  bookingRef: string;
  email: string;
  bookingStatus: string;
  onCancelled?: () => void;
}

interface Preview {
  withinFreeWindow: boolean;
  hoursUntilPickup: number;
  amountPaid: number;
  cancellationFee: number;
  refundDue: number;
  policyNote: string;
}

export function CancelPanel({ bookingRef, email, bookingStatus, onCancelled }: CancelPanelProps) {
  const [step, setStep] = React.useState<"idle" | "previewing" | "confirming" | "done">("idle");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ refundDue: number; refundNote: string } | null>(null);

  // Cancellation only makes sense for a booking that hasn't started or
  // finished yet — mirrors the same status gate ExtensionPanel uses.
  if (bookingStatus !== "PENDING" && bookingStatus !== "CONFIRMED") {
    return null;
  }

  async function handlePreview() {
    setStep("previewing");
    setError(null);
    const res = await fetch(`/api/booking/cancel?ref=${encodeURIComponent(bookingRef)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not check the cancellation policy for this booking.");
      setStep("idle");
      return;
    }
    setPreview(data);
    setStep("confirming");
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingRef, email }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not cancel this booking. Please try again.");
      return;
    }
    setResult({ refundDue: data.refundDue, refundNote: data.refundNote });
    setStep("done");
    onCancelled?.();
  }

  if (step === "done" && result) {
    return (
      <div className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2">
        Booking cancelled.{" "}
        {result.refundDue > 0
          ? `A refund of TT$${result.refundDue.toFixed(2)} is due — ${result.refundNote}`
          : result.refundNote}
      </div>
    );
  }

  if (step === "confirming" && preview) {
    return (
      <div className="text-xs space-y-2 bg-red-50 border border-red-100 rounded-md px-3 py-2 max-w-xs">
        <p className="text-neutral-700">{preview.policyNote}</p>
        {error && <p className="text-status-maintenance">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setStep("idle");
              setPreview(null);
            }}
            disabled={submitting}
          >
            Never mind
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Cancelling…" : "Confirm Cancellation"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button type="button" size="sm" variant="outline" onClick={handlePreview} disabled={step === "previewing"}>
        {step === "previewing" ? "Checking…" : "Cancel Booking"}
      </Button>
      {error && <p className="text-xs text-status-maintenance mt-1">{error}</p>}
    </div>
  );
}
