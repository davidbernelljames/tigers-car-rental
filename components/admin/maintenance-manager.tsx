"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Record_ {
  maintenanceId: number;
  vehicleId: number;
  vehicleLabel: string;
  serviceType: string;
  serviceDate: string;
  providerId: number;
  providerLabel: string;
  status: "SCHEDULED" | "COMPLETED";
}

interface Provider {
  providerId: number;
  name: string;
  serviceType: string;
  label: string;
}

const NEW_PROVIDER_VALUE = "__new__";

const PROVIDER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "MECHANIC", label: "Mechanic" },
  { value: "AUTO_DETAILER", label: "Auto Detailer" },
  { value: "BODY_TECHNICIAN", label: "Body Technician" },
  { value: "WINDOW_TINTING", label: "Window Tinting Specialist" },
  { value: "OTHER", label: "Other" },
];

export function MaintenanceManager({
  initialRecords,
  vehicles,
  providers: initialProviders,
}: {
  initialRecords: Record_[];
  vehicles: { vehicleId: number; label: string }[];
  providers: Provider[];
}) {
  const [records, setRecords] = React.useState(initialRecords);
  const [providers, setProviders] = React.useState(initialProviders);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    vehicleId: vehicles[0]?.vehicleId.toString() ?? "",
    serviceType: "",
    serviceDate: "",
    providerId: providers[0]?.providerId.toString() ?? "",
  });
  const [newProvider, setNewProvider] = React.useState({
    name: "",
    serviceType: "MECHANIC",
    phone: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [unavailableVehicles, setUnavailableVehicles] = React.useState<Record<string, string>>({});

  // [Corrected] The server already rejects a conflicting date on submit,
  // but there was no proactive indication in the form itself — a vehicle
  // that's actually unavailable for the chosen date looked identical to
  // one that's free. Reuses the same /api/vehicles/availability endpoint
  // the customer booking form already calls, treating the single service
  // date as a one-day window (day, day + 1) so the existing range-based
  // logic applies without needing a separate check built just for this.
  React.useEffect(() => {
    if (!form.serviceDate) {
      setUnavailableVehicles({});
      return;
    }
    const day = new Date(form.serviceDate);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    fetch("/api/vehicles/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupDate: day.toISOString(),
        returnDate: nextDay.toISOString(),
      }),
    })
      .then((res) => res.json())
      .then((data) => setUnavailableVehicles(data.unavailable ?? {}))
      .catch(() => setUnavailableVehicles({}));
  }, [form.serviceDate]);

  const showingNewProvider = form.providerId === NEW_PROVIDER_VALUE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // [Corrected] A malformed vehicle or provider selection previously
    // reached the server as a bare "Number must be greater than 0" schema
    // error, with nothing in the UI pointing to which field was actually
    // the problem. Catching it here, before the request is even sent,
    // gives a specific, actionable message instead.
    if (!form.vehicleId || Number(form.vehicleId) <= 0) {
      setError("Select a vehicle before scheduling.");
      setSaving(false);
      return;
    }
    if (form.providerId !== NEW_PROVIDER_VALUE && (!form.providerId || Number(form.providerId) <= 0)) {
      setError("Select a provider, or choose \"Add a new provider\", before scheduling.");
      setSaving(false);
      return;
    }
    if (form.vehicleId && unavailableVehicles[form.vehicleId]) {
      setError(`This vehicle is unavailable on that date: ${unavailableVehicles[form.vehicleId]}. Choose a different vehicle or date.`);
      setSaving(false);
      return;
    }

    let providerId = Number(form.providerId);

    // If "Add new provider" is selected, create the directory entry first,
    // then use its ID for the maintenance record itself — one submit
    // covers both, rather than making the admin do this in two steps.
    if (showingNewProvider) {
      if (!newProvider.name.trim()) {
        setError("Enter the new provider's name.");
        setSaving(false);
        return;
      }
      const providerRes = await fetch("/api/admin/maintenance-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProvider),
      });
      const providerData = await providerRes.json();
      if (!providerRes.ok) {
        setError(providerData.error ?? "Could not save the new provider.");
        setSaving(false);
        return;
      }
      const typeLabel =
        PROVIDER_TYPE_OPTIONS.find((t) => t.value === providerData.serviceType)?.label ??
        providerData.serviceType;
      const created: Provider = {
        providerId: providerData.providerId,
        name: providerData.name,
        serviceType: providerData.serviceType,
        label: `${providerData.name} — ${typeLabel}`,
      };
      setProviders((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      providerId = created.providerId;
    }

    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: Number(form.vehicleId),
        serviceType: form.serviceType,
        serviceDate: form.serviceDate,
        providerId,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save this record.");
      return;
    }
    const vehicle = vehicles.find((v) => v.vehicleId === data.vehicleId);
    const providerLabel = providers.find((p) => p.providerId === providerId)?.label ?? "";
    setRecords((prev) => [
      { ...data, vehicleLabel: vehicle?.label ?? "", providerLabel },
      ...prev,
    ]);
    setShowForm(false);
    setForm({
      vehicleId: vehicles[0]?.vehicleId.toString() ?? "",
      serviceType: "",
      serviceDate: "",
      providerId: providers[0]?.providerId.toString() ?? "",
    });
    setNewProvider({ name: "", serviceType: "MECHANIC", phone: "" });
  }

  async function toggleComplete(r: Record_) {
    const newStatus = r.status === "SCHEDULED" ? "COMPLETED" : "SCHEDULED";
    const res = await fetch(`/api/admin/maintenance/${r.maintenanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setRecords((prev) =>
        prev.map((x) => (x.maintenanceId === r.maintenanceId ? { ...x, status: newStatus } : x))
      );
    }
  }

  async function handleDelete(r: Record_) {
    if (!confirm(`Remove this maintenance record for ${r.vehicleLabel}?`)) return;
    const res = await fetch(`/api/admin/maintenance/${r.maintenanceId}`, { method: "DELETE" });
    if (res.ok) {
      setRecords((prev) => prev.filter((x) => x.maintenanceId !== r.maintenanceId));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Maintenance Schedule</h1>
          <p className="text-neutral-500 text-sm mt-1">{records.length} record(s)</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Schedule Service
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.maintenanceId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{r.vehicleLabel}</td>
                    <td className="px-4 py-3 text-neutral-600">{r.serviceType}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {new Date(r.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{r.providerLabel}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.status === "COMPLETED" ? "neutral" : "onRental"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        onClick={() => toggleComplete(r)}
                        className="text-xs text-customer underline"
                      >
                        Mark {r.status === "SCHEDULED" ? "Complete" : "Scheduled"}
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="text-neutral-400 hover:text-status-maintenance"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                      No maintenance scheduled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md max-h-[85vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Schedule Service</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label required>Vehicle</Label>
                  <Select
                    value={form.vehicleId}
                    onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  >
                    {vehicles.map((v) => {
                      const reason = unavailableVehicles[v.vehicleId];
                      return (
                        <option key={v.vehicleId} value={v.vehicleId} disabled={!!reason}>
                          {v.label}
                          {reason ? ` — ${reason}` : ""}
                        </option>
                      );
                    })}
                  </Select>
                  {form.vehicleId && unavailableVehicles[form.vehicleId] && (
                    <p className="text-xs text-status-maintenance mt-1">
                      This vehicle is unavailable on that date: {unavailableVehicles[form.vehicleId]}. Choose a different vehicle or date.
                    </p>
                  )}
                </div>
                <div>
                  <Label required>Service Type</Label>
                  <Input
                    placeholder="e.g. Oil change, brake inspection"
                    value={form.serviceType}
                    onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label required>Service Date</Label>
                  <Input
                    type="date"
                    value={form.serviceDate}
                    onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label required>Provider</Label>
                  <Select
                    value={form.providerId}
                    onChange={(e) => setForm({ ...form, providerId: e.target.value })}
                  >
                    {providers.length === 0 && (
                      <option value="">No providers yet — add one below</option>
                    )}
                    {providers.map((p) => (
                      <option key={p.providerId} value={p.providerId}>
                        {p.label}
                      </option>
                    ))}
                    <option value={NEW_PROVIDER_VALUE}>+ Add a new provider…</option>
                  </Select>
                  <p className="text-xs text-neutral-400 mt-1">
                    Not a login — just keeps the same provider consistent
                    across records rather than retyped each time.
                  </p>
                </div>

                {showingNewProvider && (
                  <div className="rounded-md border border-neutral-200 p-3 space-y-3 bg-neutral-50">
                    <div>
                      <Label required>New Provider Name</Label>
                      <Input
                        placeholder="e.g. Bob's Auto"
                        value={newProvider.name}
                        onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label required>Type</Label>
                      <Select
                        value={newProvider.serviceType}
                        onChange={(e) =>
                          setNewProvider({ ...newProvider, serviceType: e.target.value })
                        }
                      >
                        {PROVIDER_TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Phone (optional)</Label>
                      <Input
                        placeholder="For your own reference"
                        value={newProvider.phone}
                        onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-status-maintenance">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Schedule"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
