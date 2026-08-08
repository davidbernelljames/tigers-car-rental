import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewForm } from "@/components/review/review-form";
import { formatVehicleWithDetails } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

// Landing page for the T-04 feedback request email. Resolves the booking
// server-side so the customer sees which rental they're reviewing rather
// than an anonymous form.
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ bookingRef: string }>;
}) {
  const { bookingRef } = await params;

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: { vehicle: true, customer: true, review: true },
  });

  if (!booking) {
    return (
      <Message
        title="Booking not found"
        body="We couldn't find a booking with that reference. Please check the link in your email, or contact us and we'll help."
      />
    );
  }

  if (booking.bookingStatus !== "COMPLETED") {
    return (
      <Message
        title="Not ready for review yet"
        body="This rental hasn't been completed yet. You'll receive an email inviting you to leave a review once it has."
      />
    );
  }

  if (booking.review) {
    return (
      <Message
        title="Thanks — you've already reviewed this rental"
        body="Your feedback has been recorded. We appreciate you taking the time."
        success
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">How did we do?</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {formatVehicleWithDetails(booking.vehicle)} &middot; {booking.bookingRef}
      </p>
      <ReviewForm
        bookingRef={booking.bookingRef}
        customerName={booking.customer.firstName}
      />
    </div>
  );
}

function Message({
  title,
  body,
  success,
}: {
  title: string;
  body: string;
  success?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          {success && (
            <CheckCircle2 className="h-10 w-10 text-status-available mx-auto mb-3" />
          )}
          <p className="font-semibold text-neutral-900">{title}</p>
          <p className="text-sm text-neutral-500 mt-2 leading-relaxed">{body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
