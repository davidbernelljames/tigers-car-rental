import { prisma } from "@/lib/prisma";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateRentalAgreementPdf } from "@/lib/rental-agreement";

// ============================================================================
// Extracted from the original WiPay callback route (Algorithm A-02) so
// Algorithm A-05 (Rental Extension Request) can reuse the exact same PDF
// generation and Storage upload logic, rather than duplicating it.
//
// This function always reads the booking FRESH from the database rather
// than accepting booking data as a parameter — which is what makes it safe
// to reuse for an extension: if the caller has already updated the
// booking's ReturnDate/TotalCost/AmountPaid before calling this, the
// regenerated PDF picks up those new values automatically, with no special
// "is this an extension" branching needed inside the function itself.
//
// Deliberately returns only the PDF buffer and does not send any email —
// the original callback's T-01 confirmation email and the extension
// callback's confirmation email say genuinely different things, so email
// dispatch stays the caller's responsibility.
// ============================================================================

export async function regenerateRentalAgreement(
  bookingId: number,
  transactionRef: string
): Promise<Buffer | undefined> {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: { customer: true, vehicle: true },
  });
  if (!booking) return undefined;

  const settings = await prisma.systemSettings.findFirst();

  const rentalDays = Math.max(
    1,
    Math.ceil(
      (booking.returnDate.getTime() - booking.pickupDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const businessName = settings?.businessName ?? "Tiger's Car Rental";
  const businessPhone = settings?.businessPhone ?? "";
  const businessEmail = settings?.businessEmail ?? "";
  const businessAddress = settings?.businessAddress ?? "";
  const refundWindowHours = settings?.fullRefundWindowHours ?? 48;
  const cancellationFeePercent = Number(settings?.cancellationFeePercent ?? 25);
  const cancellationPolicyNote =
    `The rental is paid in full at the time of booking. Bookings cancelled more than ` +
    `${refundWindowHours} hours before the pickup date are refunded in full. Cancellations ` +
    `made within ${refundWindowHours} hours of pickup are subject to a ${cancellationFeePercent}% ` +
    `cancellation fee, with the balance refunded. Refunds are processed within 3-5 business days.`;

  let pdfBuffer: Buffer | undefined;
  let filePath = "";

  try {
    pdfBuffer = await generateRentalAgreementPdf({
      bookingRef: booking.bookingRef,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      customerAddress: booking.customer.address,
      customerPhone: booking.customer.phone,
      drivingPermitNumber: booking.customer.drivingPermitNumber,
      vehicleMake: booking.vehicle.make,
      vehicleModel: booking.vehicle.model,
      vehicleColor: booking.vehicle.color,
      vehicleRegistrationNumber: booking.vehicle.registrationNumber,
      pickupDate: booking.pickupDate,
      returnDate: booking.returnDate,
      rentalDays,
      dailyRate: Number(booking.vehicle.dailyRate),
      totalCost: Number(booking.totalCost),
      amountPaid: Number(booking.amountPaid),
      lateReturnGraceHours: settings?.lateReturnGraceHours ?? 1,
      lateFeeAmount: Number(settings?.lateFeeAmount ?? 100),
      cancellationPolicyNote,
      mileageAtPickup: booking.mileageAtPickup,
      fuelLevelAtPickup: booking.fuelLevelAtPickup,
      transactionRef,
      businessName,
      businessPhone,
      businessPhoneSecondary: settings?.businessPhoneSecondary ?? undefined,
      businessEmail,
      businessAddress,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error(`[agreement] PDF generation failed for ${booking.bookingRef}:`, err);
  }

  if (pdfBuffer) {
    try {
      const supabase = createServiceRoleClient();
      filePath = `${booking.customerId}/${booking.bookingRef}.pdf`;
      const { error } = await supabase.storage
        .from("rental-agreements")
        .upload(filePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
      if (error) {
        console.error(`[agreement] Storage upload failed for ${booking.bookingRef}:`, error.message);
        filePath = "";
      }
    } catch (err) {
      console.error(`[agreement] Storage upload threw for ${booking.bookingRef}:`, err);
      filePath = "";
    }
  }

  await prisma.rentalAgreement.upsert({
    where: { bookingId: booking.bookingId },
    update: { filePath, status: filePath ? "GENERATED" : "PENDING_RETRY", generatedAt: new Date() },
    create: { bookingId: booking.bookingId, filePath, status: filePath ? "GENERATED" : "PENDING_RETRY" },
  });

  return pdfBuffer;
}

/** Small shared helper so both callback routes fetch business info the same way. */
export async function businessInfoDefaults() {
  const settings = await prisma.systemSettings.findFirst();
  return {
    businessName: settings?.businessName ?? "Tiger's Car Rental",
    businessPhone: settings?.businessPhone ?? "",
    businessAddress: settings?.businessAddress ?? "",
  };
}
