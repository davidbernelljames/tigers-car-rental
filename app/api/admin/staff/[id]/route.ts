import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { z } from "zod";

const roleUpdateSchema = z.object({
  role: z.enum(["OWNER_ADMIN", "STAFF_AGENT"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = roleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // An owner demoting their own only owner account would lock every owner
  // out of the admin panel with no way back in short of editing the
  // database directly — refused regardless of how many other owners exist,
  // since checking "am I the last one" is more risk than it's worth here.
  if (session.user.userId === userId && parsed.data.role !== "OWNER_ADMIN") {
    return NextResponse.json(
      { error: "You cannot change your own role away from Owner." },
      { status: 409 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { userId },
      data: { role: parsed.data.role },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Staff account not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }

  if (session.user.userId === userId) {
    return NextResponse.json(
      { error: "You cannot remove your own account." },
      { status: 409 }
    );
  }

  const target = await prisma.user.findUnique({ where: { userId } });
  if (!target) {
    return NextResponse.json({ error: "Staff account not found" }, { status: 404 });
  }

  // Remove the Auth account too, not just the application-layer row — a
  // dangling Auth account with no User record would still be able to sign
  // in, hit /admin, and be redirected to /account by middleware's "no role
  // found" branch, which is confusing but not a security hole. Still worth
  // cleaning up properly rather than leaving an orphan.
  const supabase = createServiceRoleClient();
  await supabase.auth.admin.deleteUser(target.authUserId);

  await prisma.user.delete({ where: { userId } });

  return NextResponse.json({ deleted: true });
}
