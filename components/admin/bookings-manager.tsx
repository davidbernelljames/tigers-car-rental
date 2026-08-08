"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Gauge } from "lucide-react";

type Status = "PENDING" | "CONFIRMED" | "ON_RENTAL" | "COMPLETED" | "CANCELLED";
type FuelLevel = "FULL" | "THREE_QUARTER" | "HALF" | "QUARTER" | "EMPTY" | null;

interface BookingRow {
  bookingId: number;
  bookingRef: string;
  status: Status;
  pickupDate: string;
  returnDate: string;
  totalCost: number;
  amountPaid: number;
  refundDue: number | null;
  refundedAt: string | null;
  mileageAtPickup: number | null;
  fuelLevelAtPickup: FuelLevel;
  mileageAtReturn: number | null;
  fuelLevelAtReturn: FuelLevel;
  customerName: string;
  customerPhone: string;
  vehicleLabel: string;
  extensionStatus:
    "NONE" | "PENDING_REVIEW" | "APPROVED_AWAITING_PAYMENT" | "DECLINED";
  extensionRequestedReturnDate: string | null;
  extensionCost: number | null;
}

const STATUS_VARIANT: Record<
  Status,
  "available" | "onRental" | "maintenance" | "neutral"
> = {
  PENDING: "onRental",
  CONFIRMED: "available",
  ON_RENTAL: "onRental",
  COMPLETED: "neutral",
  CANCELLED: "maintenance",
};

const NEXT_ACTION: Partial<Record<Status, { label: string; to: Status }>> = {
  PENDING: { label: "Confirm", to: "CONFIRMED" },
  CONFIRMED: { label: "Start Rental", to: "ON_RENTAL" },
  ON_RENTAL: { label: "Complete", to: "COMPLETED" },
};

const FUEL_LABELS: Record<string, string> = {
  FULL: "Full",
  THREE_QUARTER: "3/4",
  HALF: "1/2",
  QUARTER: "1/4",
  EMPTY: "Empty",
};

export function BookingsManager({
  initialBookings,
  isOwner,
  extensionResult,
}: {
  initialBookings: BookingRow[];
  isOwner: boolean;
  extensionResult?: { status: string; ref?: string; message?: string } | null;
}) {
  const [bookings, setBookings] = React.useState(initialBookings);
  const [filter, setFilter] = React.useState<Status | "ALL" | "REFUND_DUE">(
    "ALL",
  );
  const [pickupModal, setPickupModal] = React.useState<BookingRow | null>(null);
  const [returnModal, setReturnModal] = React.useState<BookingRow | null>(null);
  const [reviewModal, setReviewModal] = React.useState<BookingRow | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // Surfaces the result of an extension payment redirect (Algorithm A-05) —
  // the callback itself has no UI of its own, since WiPay redirects the
  // browser straight back here.
  React.useEffect(() => {
    if (!extensionResult) return;
    const messages: Record<string, string> = {
      success: `Extension confirmed for ${extensionResult.ref ?? "the booking"}.`,
      declined: `Extension payment was declined for ${extensionResult.ref ?? "the booking"}.`,
      error:
        extensionResult.message ??
        "Something went wrong processing the extension payment.",
      "already-resolved": "This extension payment has already been processed.",
    };
    setToast(
      messages[extensionResult.status] ?? "Extension payment processed.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refundOutstandingCount = bookings.filter(
    (b) => b.refundDue && !b.refundedAt,
  ).length;

  const filtered = bookings.filter((b) => {
    if (filter === "ALL") return true;
    if (filter === "REFUND_DUE") return !!b.refundDue && !b.refundedAt;
    return b.status === filter;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function advanceStatus(booking: BookingRow) {
    const action = NEXT_ACTION[booking.status];
    if (!action) return;

    if (action.to === "ON_RENTAL" && booking.mileageAtPickup === null) {
      setPickupModal(booking);
      return;
    }
    if (action.to === "COMPLETED" && booking.mileageAtReturn === null) {
      setReturnModal(booking);
      return;
    }

    setBusyId(booking.bookingId);
    const res = await fetch(`/api/admin/bookings/${booking.bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action.to }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      showToast(data.error ?? "Could not update this booking.");
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === booking.bookingId ? { ...b, status: data.status } : b,
      ),
    );
  }

  async function cancelBooking(booking: BookingRow) {
    if (
      !confirm(
        `Cancel booking ${booking.bookingRef}? This releases the vehicle.`,
      )
    )
      return;
    setBusyId(booking.bookingId);
    const res = await fetch("/api/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingRef: booking.bookingRef }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      showToast(data.error ?? "Could not cancel this booking.");
      return;
    }
    showToast(data.refundNote ?? "Booking cancelled.");
    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === booking.bookingId
          ? {
              ...b,
              status: "CANCELLED",
              refundDue: data.refundDue > 0 ? data.refundDue : null,
            }
          : b,
      ),
    );
  }

  async function markRefunded(booking: BookingRow) {
    if (
      !confirm(
        `Confirm the TT$${booking.refundDue?.toFixed(2)} refund was issued via WiPay?`,
      )
    )
      return;
    const res = await fetch(`/api/admin/bookings/${booking.bookingId}/refund`, {
      method: "PATCH",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Could not mark this refund as issued.");
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.bookingId === booking.bookingId
          ? { ...b, refundedAt: data.refundedAt }
          : b,
      ),
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Bookings</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {bookings.length} on record
          </p>
        </div>
        {isOwner && refundOutstandingCount > 0 && (
          <Badge variant="maintenance">
            {refundOutstandingCount} refund
            {refundOutstandingCount === 1 ? "" : "s"} outstanding
          </Badge>
        )}
      </div>

      {toast && (
        <div className="mb-4 rounded-md bg-neutral-900 text-white text-sm px-4 py-2.5">
          {toast}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            "ALL",
            "PENDING",
            "CONFIRMED",
            "ON_RENTAL",
            "COMPLETED",
            "CANCELLED",
          ] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === s
                ? "bg-admin text-white border-admin"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
          </button>
        ))}
        {isOwner && (
          <button
            onClick={() => setFilter("REFUND_DUE")}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === "REFUND_DUE"
                ? "bg-status-maintenance text-white border-status-maintenance"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            Refund Due
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  {isOwner && <th className="px-4 py-3 font-medium">Paid</th>}
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const action = NEXT_ACTION[b.status];
                  return (
                    <tr
                      key={b.bookingId}
                      className="border-b border-neutral-50 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {b.bookingRef}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-neutral-900">{b.customerName}</p>
                        <p className="text-neutral-400 text-xs">
                          {formatPhoneForDisplay(b.customerPhone)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {b.vehicleLabel}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">
                        {new Date(b.pickupDate).toLocaleDateString()} –{" "}
                        {new Date(b.returnDate).toLocaleDateString()}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-neutral-600">
                          TT${b.amountPaid.toFixed(2)}
                          {b.refundDue && !b.refundedAt && (
                            <p className="text-status-maintenance text-xs">
                              Refund TT${b.refundDue.toFixed(2)} due
                            </p>
                          )}
                          {b.refundDue && b.refundedAt && (
                            <p className="text-status-available text-xs">
                              Refunded
                            </p>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[b.status]}>
                          {b.status.replace("_", " ")}
                        </Badge>
                        {b.status === "CONFIRMED" &&
                          b.mileageAtPickup !== null && (
                            <p className="text-neutral-400 text-xs mt-1">
                              {b.mileageAtPickup} km ·{" "}
                              {FUEL_LABELS[b.fuelLevelAtPickup ?? ""]}
                            </p>
                          )}
                        {b.extensionStatus === "PENDING_REVIEW" && (
                          <p className="text-xs text-status-onRental font-medium mt-1">
                            Extension requested
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {b.status === "CONFIRMED" && (
                          <Button size="sm" variant="outline" onClick={() => setPickupModal(b)}>
                            {b.mileageAtPickup === null
                              ? "Record Pickup"
                              : "Edit Pickup"}
                          </Button>
                        )}
                        {b.status === "ON_RENTAL" && (
                          <Button size="sm" variant="outline" onClick={() => setReturnModal(b)}>
                            {b.mileageAtReturn === null ? "Record Return" : "Edit Return"}
                          </Button>
                        )}
                        {b.extensionStatus === "PENDING_REVIEW" && (
                          <Button size="sm" variant="admin" onClick={() => setReviewModal(b)}>
                            Review Extension Request
                          </Button>
                        )}
                        {b.extensionStatus === "APPROVED_AWAITING_PAYMENT" && (
                          <span className="text-xs text-neutral-400">
                            Extension approved — awaiting customer payment
                          </span>
                        )}
                        {action && (
                          <Button
                            size="sm"
                            variant={
                              action.to === "CONFIRMED" ? "default" : "admin"
                            }
                            onClick={() => advanceStatus(b)}
                            disabled={busyId === b.bookingId}
                          >
                            {action.label}
                          </Button>
                        )}
                        {(b.status === "PENDING" ||
                          b.status === "CONFIRMED") && (
                          <button
                            onClick={() => cancelBooking(b)}
                            className="text-xs text-status-maintenance underline"
                            disabled={busyId === b.bookingId}
                          >
                            Cancel
                          </button>
                        )}
                        {isOwner && b.refundDue && !b.refundedAt && (
                          <button
                            onClick={() => markRefunded(b)}
                            className="text-xs text-status-available underline"
                          >
                            Mark Refunded
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={isOwner ? 7 : 6}
                      className="px-4 py-8 text-center text-neutral-400"
                    >
                      No bookings match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pickupModal && (
        <PickupModal
          booking={pickupModal}
          onClose={() => setPickupModal(null)}
          onSaved={(mileage, fuel) => {
            setBookings((prev) =>
              prev.map((b) =>
                b.bookingId === pickupModal.bookingId
                  ? { ...b, mileageAtPickup: mileage, fuelLevelAtPickup: fuel }
                  : b,
              ),
            );
            setPickupModal(null);
          }}
        />
      )}

      {returnModal && (
        <ReturnModal
          booking={returnModal}
          onClose={() => setReturnModal(null)}
          onSaved={(mileage, fuel) => {
            setBookings((prev) =>
              prev.map((b) =>
                b.bookingId === returnModal.bookingId
                  ? { ...b, mileageAtReturn: mileage, fuelLevelAtReturn: fuel }
                  : b
              )
            );
            setReturnModal(null);
          }}
        />
      )}

      {reviewModal && (
        <ReviewModal
          booking={reviewModal}
          onClose={() => setReviewModal(null)}
          onResolved={(status) => {
            setBookings((prev) =>
              prev.map((b) =>
                b.bookingId === reviewModal.bookingId
                  ? { ...b, extensionStatus: status }
                  : b,
              ),
            );
            setReviewModal(null);
          }}
        />
      )}
    </div>
  );
}

function PickupModal({
  booking,
  onClose,
  onSaved,
}: {
  booking: BookingRow;
  onClose: () => void;
  onSaved: (mileage: number, fuel: FuelLevel) => void;
}) {
  const [mileage, setMileage] = React.useState(
    booking.mileageAtPickup?.toString() ?? "",
  );
  const [fuel, setFuel] = React.useState<string>(
    booking.fuelLevelAtPickup ?? "FULL",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/bookings/${booking.bookingId}/pickup`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mileageAtPickup: Number(mileage),
        fuelLevelAtPickup: fuel,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save pickup details.");
      return;
    }
    onSaved(data.mileageAtPickup, data.fuelLevelAtPickup);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-customer" />
              <h3 className="font-semibold text-neutral-900">Pickup Details</h3>
            </div>
            <button onClick={onClose} className="text-neutral-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-4">
            {booking.bookingRef} · {booking.vehicleLabel}
          </p>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label required>Mileage (km)</Label>
              <Input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                required
              />
            </div>
            <div>
              <Label required>Fuel Level</Label>
              <Select value={fuel} onChange={(e) => setFuel(e.target.value)}>
                <option value="FULL">Full</option>
                <option value="THREE_QUARTER">3/4</option>
                <option value="HALF">1/2</option>
                <option value="QUARTER">1/4</option>
                <option value="EMPTY">Empty</option>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-status-maintenance">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnModal({
  booking,
  onClose,
  onSaved,
}: {
  booking: BookingRow;
  onClose: () => void;
  onSaved: (mileage: number, fuel: FuelLevel) => void;
}) {
  const [mileage, setMileage] = React.useState(
    booking.mileageAtReturn?.toString() ?? ""
  );
  const [fuel, setFuel] = React.useState<string>(
    booking.fuelLevelAtReturn ?? booking.fuelLevelAtPickup ?? "FULL"
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const FUEL_RANK = ["EMPTY", "QUARTER", "HALF", "THREE_QUARTER", "FULL"];
  const returnedBelowPickup =
    booking.fuelLevelAtPickup &&
    FUEL_RANK.indexOf(fuel) < FUEL_RANK.indexOf(booking.fuelLevelAtPickup);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/bookings/${booking.bookingId}/return`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mileageAtReturn: Number(mileage),
        fuelLevelAtReturn: fuel,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save return details.");
      return;
    }
    onSaved(data.mileageAtReturn, data.fuelLevelAtReturn);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-customer" />
              <h3 className="font-semibold text-neutral-900">Return Details</h3>
            </div>
            <button onClick={onClose} className="text-neutral-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-1">
            {booking.bookingRef} · {booking.vehicleLabel}
          </p>
          {booking.mileageAtPickup !== null && (
            <p className="text-xs text-neutral-400 mb-4">
              Picked up at {booking.mileageAtPickup} km, {FUEL_LABELS[booking.fuelLevelAtPickup ?? ""]} fuel
            </p>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label required>Mileage (km)</Label>
              <Input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                required
              />
            </div>
            <div>
              <Label required>Fuel Level</Label>
              <Select value={fuel} onChange={(e) => setFuel(e.target.value)}>
                <option value="FULL">Full</option>
                <option value="THREE_QUARTER">3/4</option>
                <option value="HALF">1/2</option>
                <option value="QUARTER">1/4</option>
                <option value="EMPTY">Empty</option>
              </Select>
            </div>
            {returnedBelowPickup && (
              <p className="text-xs text-status-maintenance bg-red-50 border border-red-100 rounded-md px-3 py-2">
                Returned below the pickup level ({FUEL_LABELS[booking.fuelLevelAtPickup ?? ""]}) —
                worth checking with the customer before completing this booking.
              </p>
            )}
            {error && (
              <p className="text-sm text-status-maintenance">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewModal({
  booking,
  onClose,
  onResolved,
}: {
  booking: BookingRow;
  onClose: () => void;
  onResolved: (status: "APPROVED_AWAITING_PAYMENT" | "DECLINED") => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");
  const [showDeclineReason, setShowDeclineReason] = React.useState(false);

  async function handleGrant() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(
      `/api/admin/bookings/${booking.bookingId}/extend/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant" }),
      },
    );
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not grant this request.");
      return;
    }
    onResolved("APPROVED_AWAITING_PAYMENT");
  }

  async function handleDecline() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(
      `/api/admin/bookings/${booking.bookingId}/extend/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", declineReason }),
      },
    );
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not decline this request.");
      return;
    }
    onResolved("DECLINED");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900">
              Review Extension Request
            </h3>
            <button onClick={onClose} className="text-neutral-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-1">
            {booking.bookingRef} · {booking.vehicleLabel}
          </p>
          <p className="text-sm text-neutral-500 mb-4">
            {booking.customerName}
          </p>

          <div className="rounded-md bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm mb-4">
            <p>
              Current return date:{" "}
              {new Date(booking.returnDate).toLocaleDateString()}
            </p>
            <p className="font-medium text-neutral-900 mt-1">
              Requested:{" "}
              {booking.extensionRequestedReturnDate &&
                new Date(
                  booking.extensionRequestedReturnDate,
                ).toLocaleDateString()}
            </p>
            {booking.extensionCost !== null && (
              <p className="text-neutral-500 text-xs mt-1">
                Estimated additional cost: TT${booking.extensionCost.toFixed(2)}{" "}
                (confirmed on grant)
              </p>
            )}
          </div>

          <p className="text-xs text-neutral-400 mb-4">
            Granting re-checks the vehicle's availability for the requested
            dates before approving — this only decides availability. Payment is
            completed by the customer themselves afterward; nothing here
            contacts WiPay.
          </p>

          {showDeclineReason && (
            <div className="mb-4">
              <Label>Reason (optional, shown to the customer)</Label>
              <Input
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Vehicle already booked for part of that period"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-status-maintenance mb-3">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            {!showDeclineReason ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeclineReason(true)}
                  disabled={submitting}
                >
                  Decline
                </Button>
                <Button
                  type="button"
                  onClick={handleGrant}
                  disabled={submitting}
                >
                  {submitting ? "Checking…" : "Grant"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeclineReason(false)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleDecline}
                  disabled={submitting}
                >
                  {submitting ? "Declining…" : "Confirm Decline"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
