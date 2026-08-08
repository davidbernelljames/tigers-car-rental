import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { vehicleInputSchema } from "@/lib/validations/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const body = await request.json();
  // .partial() here: this route also handles quick status-only changes from
  // the fleet table (toggle Available/In Maintenance) without requiring the
  // full edit form's fields to be resent.
  const parsed = vehicleInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details" },
      { status: 400 }
    );
  }

  try {
    const vehicle = await prisma.vehicle.update({
      where: { vehicleId },
      data: {
        ...parsed.data,
        registrationNumber:
          parsed.data.registrationNumber === "" ? null : parsed.data.registrationNumber,
      },
    });
    return NextResponse.json({ ...vehicle, dailyRate: Number(vehicle.dailyRate) });
  } catch {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  // Vehicle -> Booking is deliberately NOT cascade-delete (see schema
  // comment on that relation): losing booking history because a vehicle
  // record was removed would be a real problem, unlike a rental agreement
  // or payment record, which are meaningless without their booking. So a
  // vehicle with any booking history at all is blocked from hard deletion
  // — the correct action for a car that's no longer rented out is to leave
  // its record in place and change its status, not delete it.
  const bookingCount = await prisma.booking.count({ where: { vehicleId } });
  if (bookingCount > 0) {
    return NextResponse.json(
      {
        error: `This vehicle has ${bookingCount} booking${bookingCount === 1 ? "" : "s"} on record and cannot be deleted. If it's no longer in service, change its status instead.`,
      },
      { status: 409 }
    );
  }

  // Same reasoning for maintenance history and any vehicle-specific promo —
  // checked explicitly so the error is clear rather than a raw foreign-key
  // constraint failure from the database.
  const [maintenanceCount, promotionCount] = await Promise.all([
    prisma.maintenanceRecord.count({ where: { vehicleId } }),
    prisma.promotion.count({ where: { vehicleId } }),
  ]);
  if (maintenanceCount > 0) {
    return NextResponse.json(
      { error: "This vehicle has maintenance history on record and cannot be deleted." },
      { status: 409 }
    );
  }
  if (promotionCount > 0) {
    return NextResponse.json(
      {
        error: "This vehicle has a promotion linked to it and cannot be deleted. Remove the promotion first.",
      },
      { status: 409 }
    );
  }

  try {
    await prisma.vehicle.delete({ where: { vehicleId } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
}
