import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { maintenanceProviderInputSchema } from "@/lib/validations/admin";

// ============================================================================
// Maintenance provider directory — populates the dropdown on the Maintenance
// scheduling form. Deliberately NOT staff accounts: confirmed directly that
// Kadesh's real mechanic, detailer, and body shop should never sign into
// this system — they're arranged by phone call or WhatsApp, same as today.
// This exists purely to fix a data-quality problem the old free-text field
// had (the same real provider recorded under several different spellings
// over time), not to grant anyone access to anything.
// ============================================================================

export async function GET() {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const providers = await prisma.maintenanceProvider.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(providers);
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json();
  const parsed = maintenanceProviderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid provider details" },
      { status: 400 }
    );
  }

  const provider = await prisma.maintenanceProvider.create({
    data: {
      name: parsed.data.name,
      serviceType: parsed.data.serviceType,
      phone: parsed.data.phone || null,
    },
  });

  return NextResponse.json(provider);
}
