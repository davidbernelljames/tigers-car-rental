import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateBookingCost, BookingUnavailableError, generateBookingRef } from "@/lib/booking";
import {
  bookingDetailsSchema,
  availabilitySearchSchema,
} from "@/lib/validations/booking";

// Persists a Booking record with BookingStatus = Pending, satisfying the
// precondition stated in Algorithm A-02 (WiPay Payment Callback Handler):
// "A Booking record exists in Supabase with BookingStatus = Pending and a
// valid BookingRef." This runs when the customer submits S4 and proceeds
// to S5 payment.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { vehicleId, pickupDate, returnDate, customer } = body as {
    vehicleId: number;
    pickupDate: string;
    returnDate: string;
    customer: unknown;
  };

  const parsedCustomer = bookingDetailsSchema.safeParse(customer);
  if (!parsedCustomer.success) {
    return NextResponse.json(
      { error: "Invalid customer details", issues: parsedCustomer.error.flatten() },
      { status: 400 }
    );
  }

  // Dates are validated server-side as well as in the browser. Client-side
  // checks are a usability feature, not a security control: anyone can POST
  // directly to this endpoint, so a past pickup date or a reversed range must
  // be rejected here too.
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

  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);

  let calc;
  try {
    calc = await calculateBookingCost(vehicleId, pickup, returnD);
  } catch (err) {
    if (err instanceof BookingUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { firstName, lastName, email, phone, address, drivingPermitNumber } =
    parsedCustomer.data;

  // Find or create the Customer record by email
  const customerRecord = await prisma.customer.upsert({
    where: { email },
    update: { firstName, lastName, phone, address, drivingPermitNumber },
    create: { firstName, lastName, email, phone, address, drivingPermitNumber },
  });

  const bookingRef = await generateBookingRef();

  const booking = await prisma.booking.create({
    data: {
      bookingRef,
      customerId: customerRecord.customerId,
      vehicleId,
      pickupDate: pickup,
      returnDate: returnD,
      totalCost: calc.totalCost,
      amountPaid: 0,
      bookingStatus: "PENDING",
    },
  });

  return NextResponse.json({
    bookingId: booking.bookingId,
    bookingRef: booking.bookingRef,
    totalCost: calc.totalCost,
    amountDueNow: calc.amountDueNow,
    vehicle: calc.vehicle,
    rentalDays: calc.rentalDays,
  });
}
