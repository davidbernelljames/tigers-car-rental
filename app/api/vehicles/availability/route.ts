import { NextRequest, NextResponse } from "next/server";
import { getUnavailableVehicleIds } from "@/lib/booking";

// Called by the Vehicles & Book grid whenever pickup/return dates are
// present, so the displayed availability actually reflects the requested
// date range — not just each vehicle's static current status.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pickupDate, returnDate } = body as { pickupDate: string; returnDate: string };

  if (!pickupDate || !returnDate) {
    return NextResponse.json(
      { error: "pickupDate and returnDate are required" },
      { status: 400 }
    );
  }

  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);

  if (returnD <= pickup) {
    return NextResponse.json(
      { error: "Return date must be after pickup date" },
      { status: 400 }
    );
  }

  const unavailable = await getUnavailableVehicleIds(pickup, returnD);

  return NextResponse.json({
    unavailable: Object.fromEntries(unavailable),
  });
}
