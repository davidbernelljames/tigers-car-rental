"use client";

import * as React from "react";
import { Search, Pencil, X } from "lucide-react";
import { formatPhoneForDisplay } from "@/lib/phone";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CricketSpinner } from "@/components/ui/cricket-spinner";

interface Customer {
  customerId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  drivingPermitNumber: string;
  bookingCount: number;
  totalSpent: number;
}

export function CustomerManager({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = React.useState(initialCustomers);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [historyModal, setHistoryModal] = React.useState<Customer | null>(null);

  const filtered = customers.filter((c) => {
    const q = query.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customers</h1>
          <p className="text-neutral-500 text-sm mt-1">{customers.length} on record</p>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <Input
          className="pl-9"
          placeholder="Search name, email, or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Bookings</th>
                  <th className="px-4 py-3 font-medium">Total Spent</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.customerId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <p>{c.email}</p>
                      <p className="text-neutral-400 text-xs">{formatPhoneForDisplay(c.phone)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setHistoryModal(c)}
                        className="text-customer underline"
                      >
                        {c.bookingCount}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">TT${c.totalSpent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(c)}
                        className="text-neutral-400 hover:text-customer"
                      >
                        <Pencil className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                      No customers match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <EditCustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCustomers((prev) =>
              prev.map((c) => (c.customerId === updated.customerId ? { ...c, ...updated } : c))
            );
            setEditing(null);
          }}
        />
      )}

      {historyModal && (
        <HistoryModal customer={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: (c: Partial<Customer> & { customerId: number }) => void;
}) {
  const [form, setForm] = React.useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    address: customer.address,
    drivingPermitNumber: customer.drivingPermitNumber,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/customers/${customer.customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save changes.");
      return;
    }
    onSaved({ customerId: customer.customerId, ...form });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900">Edit Customer</h3>
            <button onClick={onClose} className="text-neutral-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-4">{customer.email}</p>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>First Name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label required>Last Name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label required>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <Label required>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <div>
              <Label required>Driving Permit Number</Label>
              <Input
                value={form.drivingPermitNumber}
                onChange={(e) => setForm({ ...form, drivingPermitNumber: e.target.value })}
                required
              />
            </div>
            {error && <p className="text-sm text-status-maintenance">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface HistoryBooking {
  bookingId: number;
  bookingRef: string;
  status: string;
  vehicleLabel: string;
  pickupDate: string;
  returnDate: string;
  totalCost: number;
  amountPaid: number;
}

const HISTORY_STATUS_VARIANT: Record<string, "available" | "onRental" | "maintenance" | "neutral"> = {
  PENDING: "onRental",
  CONFIRMED: "available",
  ON_RENTAL: "onRental",
  COMPLETED: "neutral",
  CANCELLED: "maintenance",
};

function HistoryModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [bookings, setBookings] = React.useState<HistoryBooking[]>([]);
  const [preferredVehicle, setPreferredVehicle] = React.useState<{ label: string; count: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/customers/${customer.customerId}/bookings`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setBookings(data.bookings);
          setPreferredVehicle(data.preferredVehicle);
        }
      })
      .catch(() => !cancelled && setError("Could not load booking history."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [customer.customerId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-neutral-900">
              {customer.firstName} {customer.lastName}
            </h3>
            <button onClick={onClose} className="text-neutral-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mb-4">{customer.email}</p>

          {loading && <CricketSpinner label="Loading history…" />}
          {error && <p className="text-sm text-status-maintenance">{error}</p>}

          {!loading && !error && (
            <>
              {preferredVehicle && (
                <div className="rounded-md bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm mb-4">
                  <p className="text-neutral-500 text-xs">Most rented vehicle</p>
                  <p className="font-medium text-neutral-900">
                    {preferredVehicle.label} — {preferredVehicle.count} booking
                    {preferredVehicle.count === 1 ? "" : "s"}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.bookingId} className="border border-neutral-100 rounded-md px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-neutral-900 text-sm">{b.bookingRef}</p>
                      <Badge variant={HISTORY_STATUS_VARIANT[b.status] ?? "neutral"}>
                        {b.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">{b.vehicleLabel}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(b.pickupDate).toLocaleDateString()} –{" "}
                      {new Date(b.returnDate).toLocaleDateString()} · TT${b.totalCost.toFixed(2)}
                    </p>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <p className="text-sm text-neutral-400 py-4 text-center">
                    No bookings on record for this customer.
                  </p>
                )}
              </div>

              <p className="text-xs text-neutral-400 mt-4 pt-3 border-t border-neutral-100">
                This shows real booking history only. Accident or incident history is not
                currently tracked anywhere in the system — there is no field for it yet.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
