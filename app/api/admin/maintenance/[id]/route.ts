import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { maintenanceInputSchema } from "@/lib/validations/admin";

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
  const maintenanceId = Number(id);
  if (!Number.isInteger(maintenanceId)) {
    return NextResponse.json({ error: "Invalid maintenance id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = maintenanceInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid maintenance details" },
      { status: 400 }
    );
  }

  // [Corrected] Same reverse check as the create route — but this is a
  // partial update, so a staff member marking a record Completed without
  // touching the date or vehicle shouldn't be blocked by a check against
  // fields they never changed. Only re-validate when vehicleId or
  // serviceDate is actually part of this update, falling back to the
  // existing record's values for whichever one isn't.
  if (parsed.data.vehicleId !== undefined || parsed.data.serviceDate !== undefined) {
    const existing = await prisma.maintenanceRecord.findUnique({ where: { maintenanceId } });
    if (!existing) {
      return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 });
    }
    const vehicleId = parsed.data.vehicleId ?? existing.vehicleId;
    const serviceDate = parsed.data.serviceDate ? new Date(parsed.data.serviceDate) : existing.serviceDate;

    const bookingConflict = await prisma.booking.findFirst({
      where: {
        vehicleId,
        bookingStatus: { in: ["CONFIRMED", "ON_RENTAL"] },
        pickupDate: { lte: serviceDate },
        returnDate: { gte: serviceDate },
      },
    });
    if (bookingConflict) {
      return NextResponse.json(
        {
          error: `This vehicle is booked (${bookingConflict.bookingRef}) on that date — choose a different service date or vehicle.`,
        },
        { status: 409 }
      );
    }
  }

  try {
    const record = await prisma.maintenanceRecord.update({
      where: { maintenanceId },
      data: {
        ...parsed.data,
        serviceDate: parsed.data.serviceDate ? new Date(parsed.data.serviceDate) : undefined,
      },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 });
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
  const maintenanceId = Number(id);
  if (!Number.isInteger(maintenanceId)) {
    return NextResponse.json({ error: "Invalid maintenance id" }, { status: 400 });
  }

  try {
    await prisma.maintenanceRecord.delete({ where: { maintenanceId } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 });
  }
}
