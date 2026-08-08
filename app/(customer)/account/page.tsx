"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { CustomerAuthForm } from "@/components/auth/customer-auth-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CricketSpinner } from "@/components/ui/cricket-spinner";
import { ExtensionPanel, type ExtensionStatus } from "@/components/booking/extension-panel";
import { CancelPanel } from "@/components/booking/cancel-panel";

interface BookingRow {
  bookingRef: string;
  vehicle: string;
  pickupDate: string;
  returnDate: string;
  status: string;
  hasAgreement: boolean;
  hasReview: boolean;
  extensionStatus: ExtensionStatus;
  extensionRequestedReturnDate: string | null;
  extensionCost: number | null;
  extensionDeclineReason: string | null;
}

interface CustomerProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  drivingPermitNumber: string;
}

const STATUS_VARIANT: Record<string, "available" | "onRental" | "maintenance" | "neutral"> = {
  CONFIRMED: "available",
  ON_RENTAL: "onRental",
  COMPLETED: "neutral",
  CANCELLED: "maintenance",
  PENDING: "onRental",
};

export default function AccountPage() {
  const supabase = createClient();
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);
  const [isStaffAccount, setIsStaffAccount] = React.useState(false);
  const [customer, setCustomer] = React.useState<CustomerProfile | null>(null);
  const [bookings, setBookings] = React.useState<BookingRow[]>([]);

  const loadAccount = React.useCallback(async () => {
    const res = await fetch("/api/account/bookings");
    if (res.status === 401) {
      setAuthed(false);
      setChecking(false);
      return;
    }
    const data = await res.json();
    setIsStaffAccount(!!data.isStaffAccount);
    setCustomer(data.customer);
    setBookings(data.bookings);
    setAuthed(true);
    setChecking(false);
  }, []);

  React.useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAuthed(false);
    setIsStaffAccount(false);
    setCustomer(null);
    setBookings([]);
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <CricketSpinner label="Loading…" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <CustomerAuthForm onSuccess={loadAccount} />
      </div>
    );
  }

  if (isStaffAccount) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-neutral-700 mb-1 font-medium">
              You&apos;re signed in with a staff account.
            </p>
            <p className="text-neutral-500 text-sm mb-4">
              Staff and customer sign-ins are separate — this page is for
              customer accounts only. Sign out here to use a different email
              for testing the customer experience, or head to the staff
              portal instead.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
              <a href="/admin/login">
                <Button variant="admin">Go to Staff Sign In</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">My Account</h1>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Logout
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-neutral-500 py-6 text-center">
              No bookings yet.{" "}
              <a href="/vehicles" className="text-customer underline">
                Book a vehicle
              </a>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 border-b border-neutral-100">
                    <th className="pb-2 font-medium">Ref #</th>
                    <th className="pb-2 font-medium">Vehicle</th>
                    <th className="pb-2 font-medium">Dates</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Agreement</th>
                    <th className="pb-2 font-medium">Extension</th>
                    <th className="pb-2 font-medium">Cancel</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.bookingRef} className="border-b border-neutral-50 last:border-0">
                      <td className="py-3 font-medium text-neutral-900">{b.bookingRef}</td>
                      <td className="py-3 text-neutral-600">{b.vehicle}</td>
                      <td className="py-3 text-neutral-600">
                        {new Date(b.pickupDate).toLocaleDateString()} –{" "}
                        {new Date(b.returnDate).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <Badge variant={STATUS_VARIANT[b.status] ?? "neutral"}>
                          {b.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {b.hasAgreement ? (
                          <a
                            href={`/api/booking/agreement?ref=${b.bookingRef}`}
                            className="text-customer underline text-sm"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-neutral-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 align-top w-[210px]">
                        {customer && (
                          <ExtensionPanel
                            bookingRef={b.bookingRef}
                            email={customer.email}
                            bookingStatus={b.status}
                            currentReturnDate={b.returnDate}
                            extensionStatus={b.extensionStatus}
                            extensionRequestedReturnDate={b.extensionRequestedReturnDate}
                            extensionCost={b.extensionCost}
                            extensionDeclineReason={b.extensionDeclineReason}
                            onChanged={loadAccount}
                          />
                        )}
                      </td>
                      <td className="py-3 align-top w-[120px]">
                        {customer && (
                          <CancelPanel
                            bookingRef={b.bookingRef}
                            email={customer.email}
                            bookingStatus={b.status}
                            onCancelled={loadAccount}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {customer && <ProfileCard customer={customer} onSaved={loadAccount} />}
    </div>
  );
}

function ProfileCard({
  customer,
  onSaved,
}: {
  customer: CustomerProfile;
  onSaved: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    address: customer.address,
    drivingPermitNumber: customer.drivingPermitNumber,
  });

  React.useEffect(() => {
    if (!editing) {
      setForm({
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        address: customer.address,
        drivingPermitNumber: customer.drivingPermitNumber,
      });
    }
  }, [customer, editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save your profile.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  function handleCancel() {
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      address: customer.address,
      drivingPermitNumber: customer.drivingPermitNumber,
    });
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-neutral-400">Name</dt>
              <dd className="text-neutral-900">
                {customer.firstName} {customer.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-400">Email</dt>
              <dd className="text-neutral-900">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Phone</dt>
              <dd className="text-neutral-900">{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Driving Permit #</dt>
              <dd className="text-neutral-900">{customer.drivingPermitNumber}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-neutral-400">Address</dt>
              <dd className="text-neutral-900">{customer.address}</dd>
            </div>
          </dl>
          <p className="text-xs text-neutral-400 mt-4">
            Email can&apos;t be changed here since it's tied to your sign-in. Contact us if it needs updating.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              placeholder="+18684900175"
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
            <Label required>Driving Permit #</Label>
            <Input
              value={form.drivingPermitNumber}
              onChange={(e) => setForm({ ...form, drivingPermitNumber: e.target.value })}
              required
            />
          </div>

          {error && <p className="text-sm text-status-maintenance">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
