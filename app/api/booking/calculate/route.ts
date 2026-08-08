import { NextRequest, NextResponse } from "next/server";
import { calculateBookingCost, BookingUnavailableError } from "@/lib/booking";
import { availabilitySearchSchema } from "@/lib/validations/booking";

// Implements Algorithm A-01: Booking Cost and Availability Calculation
// (Pseudocode document). Called from S2 Vehicles & Book (Book Now) and the
// S4/S5 booking summary panel as a live preview before the customer submits
// their details.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { vehicleId, pickupDate, returnDate } = body as {
    vehicleId: number;
    pickupDate: string;
    returnDate: string;
  };

  if (!vehicleId || !pickupDate || !returnDate) {
    return NextResponse.json(
      { error: "vehicleId, pickupDate, and returnDate are required" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(vehicleId) || vehicleId < 1) {
    return NextResponse.json({ error: "Invalid vehicle" }, { status: 400 });
  }

  // Same server-side date check as /api/booking/create — this endpoint is
  // equally reachable by a direct POST.
  const parsedDates = availabilitySearchSchema.safeParse({
    pickupDate,
    returnDate,
  });
  if (!parsedDates.success) {
    return NextResponse.json(
      { error: parsedDates.error.issues[0]?.message ?? "Invalid dates" },
      { status: 400 }
    );
  }

  try {
    const result = await calculateBookingCost(
      vehicleId,
      new Date(pickupDate),
      new Date(returnDate)
    );
    return NextResponse.json({ available: true, ...result });
  } catch (err) {
    if (err instanceof BookingUnavailableError) {
      return NextResponse.json({ available: false, reason: err.message });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
