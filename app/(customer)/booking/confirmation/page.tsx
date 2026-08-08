import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatVehicleWithDetails } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingRef?: string }>;
}) {
  const { bookingRef } = await searchParams;
  if (!bookingRef) notFound();

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { vehicle: true, rentalAgreement: true },
  });

  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Card>
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-8 w-8 text-status-available" />
          </div>

          <div>
            <p className="text-sm text-neutral-500">Booking Reference</p>
            <p className="text-3xl font-bold text-neutral-900">{booking.bookingRef}</p>
          </div>

          <p className="inline-block rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-status-available">
            {booking.bookingStatus === "PENDING" ? "Pending Payment" : "Confirmed"}
          </p>

          <div className="text-left rounded-md bg-neutral-50 border border-neutral-200 p-4">
            <p className="font-medium text-neutral-900">
              {formatVehicleWithDetails(booking.vehicle)}
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              {booking.pickupDate.toLocaleDateString()} to{" "}
              {booking.returnDate.toLocaleDateString()}
            </p>
            <div className="flex justify-between text-sm mt-3 pt-3 border-t border-neutral-200">
              <span className="text-neutral-500">Paid in Full</span>
              <span className="font-medium">
                TT${Number(booking.amountPaid).toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-sm text-neutral-500">
            A confirmation email with your PDF rental agreement will be sent to
            your inbox once payment is verified.
          </p>

          {booking.rentalAgreement && (
            <a href={`/api/booking/agreement?ref=${booking.bookingRef}`}>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4" />
                Download Rental Agreement (PDF)
              </Button>
            </a>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/account" className="flex-1">
              <Button variant="outline" className="w-full">
                View My Bookings
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button className="w-full">Return to Homepage</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
