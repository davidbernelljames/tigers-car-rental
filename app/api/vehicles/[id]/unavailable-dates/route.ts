import { NextRequest, NextResponse } from "next/server";
import { getVehicleUnavailableDates } from "@/lib/booking";

// [New] Feeds AvailabilityCalendar (S3 Booking Details) — a customer facing,
// unauthenticated route by design, the same way vehicle listings and prices
// are already public. No booking or customer data is exposed here, only
// which dates are free, the same information the old flow eventually
// revealed anyway, just one step later and after an extra click.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const unavailable = await getVehicleUnavailableDates(vehicleId);
  return NextResponse.json({ unavailable });
}
