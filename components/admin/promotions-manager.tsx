"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Promotion {
  promotionId: number;
  code: string;
  vehicleCategory: "ECONOMY" | "SEDAN";
  discountPercent: number;
  startDate: string;
  expiryDate: string;
  vehicleId: number | null;
  vehicleLabel: string | null;
  isActive: boolean;
}

export function PromotionsManager({
  initialPromotions,
  vehicles,
}: {
  initialPromotions: Promotion[];
  vehicles: { vehicleId: number; label: string }[];
}) {
  const [promotions, setPromotions] = React.useState(initialPromotions);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    code: "",
    vehicleCategory: "SEDAN" as Promotion["vehicleCategory"],
    discountPercent: "",
    startDate: "",
    expiryDate: "",
    vehicleId: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        vehicleCategory: form.vehicleCategory,
        discountPercent: Number(form.discountPercent),
        startDate: form.startDate,
        expiryDate: form.expiryDate,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save this promotion.");
      return;
    }

    const now = new Date();
    const vehicle = vehicles.find((v) => v.vehicleId === data.vehicleId);
    setPromotions((prev) => [
      {
        ...data,
        startDate: data.startDate.split("T")[0],
        expiryDate: data.expiryDate.split("T")[0],
        vehicleLabel: vehicle?.label ?? null,
        isActive: new Date(data.startDate) <= now && new Date(data.expiryDate) >= now,
      },
      ...prev,
    ]);
    setShowForm(false);
    setForm({ code: "", vehicleCategory: "SEDAN", discountPercent: "", startDate: "", expiryDate: "", vehicleId: "" });
  }

  async function handleDelete(p: Promotion) {
    if (!confirm(`Delete promotion ${p.code}?`)) return;
    const res = await fetch(`/api/admin/promotions/${p.promotionId}`, { method: "DELETE" });
    if (res.ok) {
      setPromotions((prev) => prev.filter((x) => x.promotionId !== p.promotionId));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Promotions</h1>
          <p className="text-neutral-500 text-sm mt-1">{promotions.length} on record</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Promotion
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Applies To</th>
                  <th className="px-4 py-3 font-medium">Discount</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.promotionId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.code}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {p.vehicleLabel ?? `All ${p.vehicleCategory}`}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{p.discountPercent}%</td>
                    <td className="px-4 py-3 text-neutral-600 text-xs">
                      {new Date(p.startDate).toLocaleDateString()} –{" "}
                      {new Date(p.expiryDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? "available" : "neutral"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-neutral-400 hover:text-status-maintenance"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {promotions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                      No promotions yet.
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
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Promotion</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label required>Promo Code</Label>
                  <Input
                    placeholder="e.g. CARNIVAL25"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Category</Label>
                    <Select
                      value={form.vehicleCategory}
                      onChange={(e) =>
                        setForm({ ...form, vehicleCategory: e.target.value as Promotion["vehicleCategory"] })
                      }
                    >
                      <option value="ECONOMY">Economy</option>
                      <option value="SEDAN">Sedan</option>
                    </Select>
                  </div>
                  <div>
                    <Label required>Discount %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.discountPercent}
                      onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Specific Vehicle (optional)</Label>
                  <Select
                    value={form.vehicleId}
                    onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  >
                    <option value="">All vehicles in category</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicleId} value={v.vehicleId}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>Start Date</Label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label required>Expiry Date</Label>
                    <Input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-status-maintenance">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Add Promotion"}
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
