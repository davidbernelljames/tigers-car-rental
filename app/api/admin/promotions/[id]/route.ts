import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OWNER_ONLY } from "@/lib/staff-auth";
import { promotionUpdateSchema } from "@/lib/validations/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const promotionId = Number(id);
  if (!Number.isInteger(promotionId)) {
    return NextResponse.json({ error: "Invalid promotion id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = promotionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid promotion details" },
      { status: 400 }
    );
  }

  // The cross-field date-order check lives in promotionInputSchema's
  // .refine(), which only applies at creation. Re-checked here manually
  // whenever both dates happen to be present in the same partial update.
  if (
    parsed.data.startDate &&
    parsed.data.expiryDate &&
    new Date(parsed.data.expiryDate) <= new Date(parsed.data.startDate)
  ) {
    return NextResponse.json(
      { error: "Expiry date must be after the start date" },
      { status: 400 }
    );
  }

  try {
    const promotion = await prisma.promotion.update({
      where: { promotionId },
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : undefined,
      },
    });
    return NextResponse.json({ ...promotion, discountPercent: Number(promotion.discountPercent) });
  } catch {
    return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OWNER_ONLY);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const promotionId = Number(id);
  if (!Number.isInteger(promotionId)) {
    return NextResponse.json({ error: "Invalid promotion id" }, { status: 400 });
  }

  try {
    await prisma.promotion.delete({ where: { promotionId } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
  }
}
