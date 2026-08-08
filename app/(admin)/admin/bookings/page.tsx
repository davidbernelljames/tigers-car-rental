import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth";
import { BookingsManager } from "@/components/admin/bookings-manager";
import { formatVehicleWithDetails } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ extension?: string; ref?: string; message?: string }>;
}) {
  const session = await getStaffSession();
  const params = await searchParams;

  const bookings = await prisma.booking.findMany({
    include: { customer: true, vehicle: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <BookingsManager
      isOwner={session?.role === "OWNER_ADMIN"}
      extensionResult={
        params.extension
          ? { status: params.extension, ref: params.ref, message: params.message }
          : null
      }
      initialBookings={bookings.map((b) => ({
        bookingId: b.bookingId,
        bookingRef: b.bookingRef,
        status: b.bookingStatus,
        pickupDate: b.pickupDate.toISOString(),
        returnDate: b.returnDate.toISOString(),
        totalCost: Number(b.totalCost),
        amountPaid: Number(b.amountPaid),
        refundDue: b.refundDue ? Number(b.refundDue) : null,
        refundedAt: b.refundedAt ? b.refundedAt.toISOString() : null,
        mileageAtPickup: b.mileageAtPickup,
        fuelLevelAtPickup: b.fuelLevelAtPickup,
        mileageAtReturn: b.mileageAtReturn,
        fuelLevelAtReturn: b.fuelLevelAtReturn,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerPhone: b.customer.phone,
        vehicleLabel: formatVehicleWithDetails(b.vehicle),
        extensionStatus: b.extensionStatus,
        extensionRequestedReturnDate: b.extensionRequestedReturnDate
          ? b.extensionRequestedReturnDate.toISOString()
          : null,
        extensionCost: b.extensionCost ? Number(b.extensionCost) : null,
      }))}
    />
  );
}
