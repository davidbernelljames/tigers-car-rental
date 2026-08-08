"use client";

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface StaffMember {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "OWNER_ADMIN" | "STAFF_AGENT";
}

const ROLE_LABELS: Record<StaffMember["role"], string> = {
  OWNER_ADMIN: "Owner",
  STAFF_AGENT: "Admin Assistant",
};

export function StaffManager({
  initialStaff,
  currentUserId,
}: {
  initialStaff: StaffMember[];
  currentUserId: number;
}) {
  const [staff, setStaff] = React.useState(initialStaff);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "STAFF_AGENT" as StaffMember["role"],
    password: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create this account.");
      return;
    }
    setStaff((prev) => [...prev, data]);
    setShowForm(false);
    setForm({ email: "", firstName: "", lastName: "", role: "STAFF_AGENT", password: "" });
  }

  async function handleRoleChange(member: StaffMember, role: StaffMember["role"]) {
    const res = await fetch(`/api/admin/staff/${member.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not change this role.");
      return;
    }
    setStaff((prev) => prev.map((s) => (s.userId === member.userId ? { ...s, role } : s)));
  }

  async function handleDelete(member: StaffMember) {
    if (!confirm(`Remove ${member.firstName} ${member.lastName}'s access?`)) return;
    const res = await fetch(`/api/admin/staff/${member.userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not remove this account.");
      return;
    }
    setStaff((prev) => prev.filter((s) => s.userId !== member.userId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff</h1>
          <p className="text-neutral-500 text-sm mt-1">{staff.length} account(s)</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-400 border-b border-neutral-100">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const isSelf = s.userId === currentUserId;
                return (
                  <tr key={s.userId} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {s.firstName} {s.lastName}
                      {isSelf && <Badge variant="neutral" className="ml-2">You</Badge>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{s.email}</td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-neutral-600">{ROLE_LABELS[s.role]}</span>
                      ) : (
                        <Select
                          value={s.role}
                          onChange={(e) =>
                            handleRoleChange(s, e.target.value as StaffMember["role"])
                          }
                          className="h-8 text-xs py-0"
                        >
                          <option value="OWNER_ADMIN">Owner</option>
                          <option value="STAFF_AGENT">Admin Assistant</option>
                                                  </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(s)}
                          className="text-neutral-400 hover:text-status-maintenance"
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Staff Account</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                  <Label required>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label required>Temporary Password</Label>
                  <PasswordInput
                    minLength={10}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    At least 10 characters, with a lowercase letter, an
                    uppercase letter, a number, and a symbol. Share this with
                    them directly — there is no invite email.
                  </p>
                </div>
                <div>
                  <Label required>Role</Label>
                  <Select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as StaffMember["role"] })}
                  >
                    <option value="STAFF_AGENT">Admin Assistant</option>
                                        <option value="OWNER_ADMIN">Owner</option>
                  </Select>
                </div>
                {error && <p className="text-sm text-status-maintenance">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating…" : "Create Account"}
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
