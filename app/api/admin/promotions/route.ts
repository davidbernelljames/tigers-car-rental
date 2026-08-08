import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { promotionInputSchema } from "@/lib/validations/admin";

// A7 Promotions Management. Owner-only per middleware's OWNER_ONLY_PREFIXES
// — discount control is a financial/commercial decision the SS1 role
// definition explicitly excludes STAFF_AGENT from.
export async function GET() {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const promotions = await prisma.promotion.findMany({
    include: { vehicle: true },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(
    promotions.map((p) => ({
      ...p,
      discountPercent: Number(p.discountPercent),
    }))
  );
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
  const parsed = promotionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid promotion details" },
      { status: 400 }
    );
  }

  const existing = await prisma.promotion.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "A promotion with this code already exists." }, { status: 409 });
  }

  const promotion = await prisma.promotion.create({
    data: {
      code: parsed.data.code,
      vehicleCategory: parsed.data.vehicleCategory,
      discountPercent: parsed.data.discountPercent,
      startDate: new Date(parsed.data.startDate),
      expiryDate: new Date(parsed.data.expiryDate),
      vehicleId: parsed.data.vehicleId ?? null,
    },
  });

  return NextResponse.json({ ...promotion, discountPercent: Number(promotion.discountPercent) });
}
