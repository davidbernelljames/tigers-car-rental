import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const bookingRef = request.nextUrl.searchParams.get("ref");
  if (!bookingRef) {
    return NextResponse.json({ error: "ref query param is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { vehicle: true, customer: true, rentalAgreement: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    bookingRef: booking.bookingRef,
    status: booking.bookingStatus,
    pickupDate: booking.pickupDate,
    returnDate: booking.returnDate,
    totalCost: Number(booking.totalCost),
    amountPaid: Number(booking.amountPaid),
    vehicle: {
      make: booking.vehicle.make,
      model: booking.vehicle.model,
      color: booking.vehicle.color,
      registrationNumber: booking.vehicle.registrationNumber,
    },
    customer: {
      firstName: booking.customer.firstName,
      email: booking.customer.email,
    },
    agreementPath: booking.rentalAgreement?.filePath ?? null,
  });
}
