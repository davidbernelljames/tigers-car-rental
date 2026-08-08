import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole, StaffAuthError, OPERATIONAL_STAFF } from "@/lib/staff-auth";
import { vehicleInputSchema } from "@/lib/validations/admin";

// A4 Fleet Management. Both OWNER_ADMIN and STAFF_AGENT may manage the
// fleet — day-to-day status changes (marking a car in maintenance) are
// exactly the kind of operational task a rental agent needs to do without
// waiting on the owner, per the SS1 role split.

export async function GET() {
  try {
    await requireStaffRole(OPERATIONAL_STAFF);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const vehicles = await prisma.vehicle.findMany({ orderBy: { vehicleId: "asc" } });
  return NextResponse.json(
    vehicles.map((v) => ({
      ...v,
      dailyRate: Number(v.dailyRate),
    }))
  );
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
  const parsed = vehicleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid vehicle details" },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ...parsed.data,
      registrationNumber: parsed.data.registrationNumber || null,
      status: parsed.data.status ?? "AVAILABLE",
    },
  });

  return NextResponse.json({ ...vehicle, dailyRate: Number(vehicle.dailyRate) });
}
