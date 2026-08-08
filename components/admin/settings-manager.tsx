"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Settings {
  businessName: string;
  businessPhone: string;
  businessPhoneSecondary: string;
  businessEmail: string;
  businessAddress: string;
  fullRefundWindowHours: number;
  cancellationFeePercent: number;
  lateReturnGraceHours: number;
  lateFeeAmount: number;
  reminderNotificationsEnabled: boolean;
  feedbackNotificationsEnabled: boolean;
}

export function SettingsManager({ initialSettings }: { initialSettings: Settings | null }) {
  const [form, setForm] = React.useState<Settings>(
    initialSettings ?? {
      businessName: "",
      businessPhone: "",
      businessPhoneSecondary: "",
      businessEmail: "",
      businessAddress: "",
      fullRefundWindowHours: 48,
      cancellationFeePercent: 25,
      lateReturnGraceHours: 1,
      lateFeeAmount: 100,
      reminderNotificationsEnabled: true,
      feedbackNotificationsEnabled: true,
    }
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save settings.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">System Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label required>Business Name</Label>
              <Input
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Primary Phone</Label>
                <Input
                  value={form.businessPhone}
                  onChange={(e) => setForm({ ...form, businessPhone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Secondary Phone</Label>
                <Input
                  value={form.businessPhoneSecondary}
                  onChange={(e) => setForm({ ...form, businessPhoneSecondary: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label required>Email</Label>
              <Input
                type="email"
                value={form.businessEmail}
                onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
                required
              />
            </div>
            <div>
              <Label required>Address</Label>
              <Input
                value={form.businessAddress}
                onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancellation Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-neutral-500">
              These figures directly control what customers see on the FAQ,
              Terms page, and rental agreement PDF — changes here take effect
              on the next booking made.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Free Cancellation Window (hours)</Label>
                <Input
                  type="number"
                  value={form.fullRefundWindowHours}
                  onChange={(e) =>
                    setForm({ ...form, fullRefundWindowHours: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label required>Cancellation Fee (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cancellationFeePercent}
                  onChange={(e) =>
                    setForm({ ...form, cancellationFeePercent: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Late Return Grace Period (hours)</Label>
                <Input
                  type="number"
                  value={form.lateReturnGraceHours}
                  onChange={(e) =>
                    setForm({ ...form, lateReturnGraceHours: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label required>Late Fee (TT$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.lateFeeAmount}
                  onChange={(e) =>
                    setForm({ ...form, lateFeeAmount: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              A flat fee applied once a rental is returned beyond the grace
              period — the same amount regardless of which vehicle was
              rented.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automated Emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-neutral-500">
              Turning one of these off stops that email being sent for all
              future bookings. It does not affect booking confirmations, which
              always send.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-customer-accent"
                checked={form.reminderNotificationsEnabled}
                onChange={(e) =>
                  setForm({ ...form, reminderNotificationsEnabled: e.target.checked })
                }
              />
              <span className="text-sm">
                <span className="font-medium text-neutral-900">Pickup reminders</span>
                <span className="block text-neutral-500 text-xs mt-0.5">
                  Sent automatically 48 hours and again 24 hours before a
                  confirmed pickup.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-customer-accent"
                checked={form.feedbackNotificationsEnabled}
                onChange={(e) =>
                  setForm({ ...form, feedbackNotificationsEnabled: e.target.checked })
                }
              />
              <span className="text-sm">
                <span className="font-medium text-neutral-900">
                  Post-rental feedback requests
                </span>
                <span className="block text-neutral-500 text-xs mt-0.5">
                  Sent when a rental is marked Complete, inviting the customer
                  to leave a rating.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-status-maintenance">{error}</p>}
        {saved && <p className="text-sm text-status-available">Settings saved.</p>}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
