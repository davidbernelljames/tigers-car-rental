import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { staffInputSchema } from "@/lib/validations/admin";

// A new staff-management screen (not one of the original A1-A9 numbered
// screens, but the natural owner-only counterpart to prisma/seed-staff.ts —
// that script created the three demo accounts by hand; this is how Kadesh
// adds a real one without needing the codebase or a terminal).
export async function GET() {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const staff = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(staff);
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json();
  const parsed = staffInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid staff details" },
      { status: 400 }
    );
  }
  if (!parsed.data.password) {
    return NextResponse.json(
      { error: "A password is required when creating a new staff account." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json(
      { error: "A staff account with this email already exists." },
      { status: 409 }
    );
  }

  // Creating the Auth account requires the service-role key (bypasses email
  // confirmation, which would otherwise leave the account unusable until
  // someone clicks a link in an inbox that may not be checked) — the same
  // approach prisma/seed-staff.ts uses for the three demo accounts.
  const supabase = createServiceRoleClient();
  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Could not create the account." },
      { status: 502 }
    );
  }

  const user = await prisma.user.create({
    data: {
      authUserId: created.user.id,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
    },
  });

  return NextResponse.json(user);
}
