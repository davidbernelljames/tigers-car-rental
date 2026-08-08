import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { settingsInputSchema } from "@/lib/validations/admin";

// A9 System Settings. Owner-only per middleware — cancellation policy, late
// fee grace period, and business contact details are exactly the kind of
// business-rule changes the SS1 role split reserves for OWNER_ADMIN.
export async function PATCH(request: NextRequest) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json();
  const parsed = settingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
      { status: 400 }
    );
  }

  const settings = await prisma.systemSettings.upsert({
    where: { settingsId: 1 },
    update: { ...parsed.data, businessPhoneSecondary: parsed.data.businessPhoneSecondary || null },
    create: { settingsId: 1, ...parsed.data, businessPhoneSecondary: parsed.data.businessPhoneSecondary || null },
  });

  return NextResponse.json({
    ...settings,
    cancellationFeePercent: Number(settings.cancellationFeePercent),
  });
}
