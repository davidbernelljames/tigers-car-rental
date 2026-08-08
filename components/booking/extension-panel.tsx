"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================================================
// Shared across Find My Booking (guests) and My Account (signed-in
// customers) — the customer-facing half of the corrected Algorithm A-05.
// Both contexts verify identity the same way (reference + email), so one
// component covers both rather than two near-duplicates.
// ============================================================================

export type ExtensionStatus = "NONE" | "PENDING_REVIEW" | "APPROVED_AWAITING_PAYMENT" | "DECLINED";

export interface ExtensionPanelProps {
  bookingRef: string;
  email: string;
  bookingStatus: string;
  currentReturnDate: string;
  extensionStatus: ExtensionStatus;
  extensionRequestedReturnDate?: string | null;
  extensionCost?: number | null;
  extensionDeclineReason?: string | null;
  onChanged?: () => void;
}

export function ExtensionPanel({
  bookingRef,
  email,
  bookingStatus,
  currentReturnDate,
  extensionStatus,
  extensionRequestedReturnDate,
  extensionCost,
  extensionDeclineReason,
  onChanged,
}: ExtensionPanelProps) {
  const [showForm, setShowForm] = React.useState(false);
  const [newDate, setNewDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Extensions only make sense for a booking that hasn't finished yet.
  if (bookingStatus !== "CONFIRMED" && bookingStatus !== "ON_RENTAL") {
    return null;
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/booking/request-extension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingRef, email, proposedReturnDate: newDate }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not submit the extension request.");
      return;
    }
    setShowForm(false);
    onChanged?.();
  }

  async function handlePayNow() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/booking/extension-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingRef, email }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not start the extension payment.");
      return;
    }
    window.location.href = data.url;
  }

  const minDate = (() => {
    const d = new Date(currentReturnDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  if (extensionStatus === "PENDING_REVIEW") {
    return (
      <div className="rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm mt-2">
        <p className="text-neutral-700">
          Extension requested to{" "}
          {extensionRequestedReturnDate && new Date(extensionRequestedReturnDate).toLocaleDateString()}{" "}
          — awaiting review.
        </p>
      </div>
    );
  }

  if (extensionStatus === "APPROVED_AWAITING_PAYMENT") {
    return (
      <div className="rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm mt-2 space-y-2">
        <p className="text-neutral-700">
          Extension approved to{" "}
          {extensionRequestedReturnDate && new Date(extensionRequestedReturnDate).toLocaleDateString()}
          {" — "}TT${Number(extensionCost).toFixed(2)} due.
        </p>
        {error && <p className="text-status-maintenance text-xs">{error}</p>}
        <Button type="button" size="sm" onClick={handlePayNow} disabled={submitting}>
          {submitting ? "Starting…" : "Pay Now"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {extensionStatus === "DECLINED" && (
        <p className="text-xs text-neutral-500 mb-2">
          A previous extension request was declined
          {extensionDeclineReason ? `: ${extensionDeclineReason}` : "."}
        </p>
      )}
      {!showForm ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
          Request Extension
        </Button>
      ) : (
        <form onSubmit={handleRequest} className="flex items-end gap-2 flex-wrap">
          <div>
            <Label htmlFor={`ext-date-${bookingRef}`} className="text-xs block mb-1">
              New Return Date
            </Label>
            <Input
              id={`ext-date-${bookingRef}`}
              type="date"
              min={minDate}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              className="h-8 w-[150px] text-xs px-2 py-0"
            />
          </div>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Requesting…" : "Submit"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </form>
      )}
      {error && <p className="text-status-maintenance text-xs mt-1">{error}</p>}
    </div>
  );
}
