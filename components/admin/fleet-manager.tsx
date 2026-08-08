"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Vehicle {
  vehicleId: number;
  make: string;
  model: string;
  color: string;
  registrationNumber: string | null;
  seats: number;
  dailyRate: number;
  category: "ECONOMY" | "SEDAN";
  status: "AVAILABLE" | "ON_RENTAL" | "IN_MAINTENANCE" | "RETIRED";
  photoUrl: string | null;
}

const STATUS_VARIANT: Record<Vehicle["status"], "available" | "onRental" | "maintenance" | "neutral"> = {
  AVAILABLE: "available",
  ON_RENTAL: "onRental",
  IN_MAINTENANCE: "maintenance",
  RETIRED: "neutral",
};

const emptyForm = {
  make: "",
  model: "",
  color: "",
  registrationNumber: "",
  seats: "5",
  dailyRate: "",
  category: "SEDAN" as Vehicle["category"],
  status: "AVAILABLE" as Vehicle["status"],
};

export function FleetManager({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const [vehicles, setVehicles] = React.useState(initialVehicles);
  const [editing, setEditing] = React.useState<Vehicle | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = React.useState(false);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      make: v.make,
      model: v.model,
      color: v.color,
      registrationNumber: v.registrationNumber ?? "",
      seats: v.seats.toString(),
      dailyRate: v.dailyRate.toString(),
      category: v.category,
      status: v.status,
    });
    setError(null);
    setPhotoFile(null);
    setPhotoPreview(v.photoUrl);
    setShowForm(true);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // A freshly picked but not-yet-uploaded file only exists in local state —
  // nothing to call the server about, just clear it. A photo already saved
  // on the vehicle needs an actual request, since it exists in Storage and
  // in the database, not just in this form.
  async function handleRemovePhoto() {
    if (photoFile) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!editing?.photoUrl) return;

    setRemovingPhoto(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vehicles/${editing.vehicleId}/photo`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not remove the photo.");
        return;
      }
      setPhotoPreview(null);
      setEditing(data);
      setVehicles((prev) =>
        prev.map((v) => (v.vehicleId === data.vehicleId ? data : v))
      );
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setRemovingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      make: form.make,
      model: form.model,
      color: form.color,
      registrationNumber: form.registrationNumber.trim() || null,
      seats: Number(form.seats),
      dailyRate: Number(form.dailyRate),
      category: form.category,
      status: form.status,
    };

    const url = editing ? `/api/admin/vehicles/${editing.vehicleId}` : "/api/admin/vehicles";
    const method = editing ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save the vehicle.");
        setSaving(false);
        return;
      }

      let finalVehicle = data;
      let photoFailed = false;

      // Photo upload happens as a second step, after the vehicle record
      // itself exists — a brand-new vehicle has no ID until this point,
      // and the photo endpoint needs one to attach the upload to.
      if (photoFile) {
        setUploadingPhoto(true);
        const photoForm = new FormData();
        photoForm.append("photo", photoFile);
        const photoRes = await fetch(`/api/admin/vehicles/${data.vehicleId}/photo`, {
          method: "POST",
          body: photoForm,
        });
        const photoData = await photoRes.json();
        setUploadingPhoto(false);
        if (!photoRes.ok) {
          // The vehicle itself saved successfully — only the photo step
          // failed, so surface that distinctly rather than implying the
          // whole save failed.
          setError(photoData.error ?? "Vehicle saved, but the photo could not be uploaded.");
          photoFailed = true;
        } else {
          finalVehicle = photoData;
        }
      }

      setVehicles((prev) =>
        editing
          ? prev.map((v) => (v.vehicleId === finalVehicle.vehicleId ? finalVehicle : v))
          : [...prev, finalVehicle]
      );
      if (!photoFailed) setShowForm(false);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatus(v: Vehicle, status: Vehicle["status"]) {
    const res = await fetch(`/api/admin/vehicles/${v.vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setVehicles((prev) => prev.map((x) => (x.vehicleId === v.vehicleId ? data : x)));
    }
  }

  async function handleDelete(v: Vehicle) {
    if (
      !confirm(
        `Delete ${v.make} ${v.model}? This cannot be undone. Vehicles with any booking, maintenance, or promotion history cannot be deleted — you'll be told if that's the case.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/vehicles/${v.vehicleId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not delete this vehicle.");
      return;
    }
    setVehicles((prev) => prev.filter((x) => x.vehicleId !== v.vehicleId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Fleet Management</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} on record
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Vehicle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Registration</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Rate/day</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.vehicleId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">
                        {v.make} {v.model}
                      </p>
                      <p className="text-neutral-400 text-xs">
                        {v.color} · {v.seats} seats
                      </p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {v.registrationNumber ?? (
                        <span className="text-neutral-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{v.category}</td>
                    <td className="px-4 py-3 text-neutral-600">TT${v.dailyRate.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={v.status}
                        onChange={(e) =>
                          handleQuickStatus(v, e.target.value as Vehicle["status"])
                        }
                        className="h-8 text-xs py-0"
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="ON_RENTAL">On Rental</option>
                        <option value="IN_MAINTENANCE">In Maintenance</option>
                        <option value="RETIRED">Retired (Sold)</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(v)}
                        className="text-neutral-400 hover:text-customer mr-3"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(v)}
                        className="text-neutral-400 hover:text-status-maintenance"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{editing ? "Edit Vehicle" : "Add Vehicle"}</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Make</Label>
                    <Input
                      value={form.make}
                      onChange={(e) => setForm({ ...form, make: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label required>Model</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label required>Colour</Label>
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Registration Number</Label>
                  <Input
                    placeholder="Leave blank if unconfirmed"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Seats</Label>
                    <Input
                      type="number"
                      value={form.seats}
                      onChange={(e) => setForm({ ...form, seats: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label required>Daily Rate (TT$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.dailyRate}
                      onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Category</Label>
                    <Select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value as Vehicle["category"] })
                      }
                    >
                      <option value="ECONOMY">Economy</option>
                      <option value="SEDAN">Sedan</option>
                    </Select>
                  </div>
                  <div>
                    <Label required>Status</Label>
                    <Select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value as Vehicle["status"] })
                      }
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="ON_RENTAL">On Rental</option>
                      <option value="IN_MAINTENANCE">In Maintenance</option>
                      <option value="RETIRED">Retired (Sold)</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Photo</Label>
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Vehicle preview"
                      className="mb-2 h-32 w-full rounded-md object-cover border border-neutral-200"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} />
                    {photoPreview && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRemovePhoto}
                        disabled={removingPhoto}
                      >
                        {removingPhoto ? "Removing…" : "Remove Photo"}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">JPEG, PNG, or WebP, up to 5MB.</p>
                </div>

                {error && <p className="text-sm text-status-maintenance">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : editing ? "Save Changes" : "Add Vehicle"}
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
