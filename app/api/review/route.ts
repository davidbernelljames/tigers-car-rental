import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ============================================================================
// Review submission — the destination of the T-04 feedback request email.
//
// NO LOGIN REQUIRED, deliberately. Guest checkout is the primary booking
// path (see the FAQ: no account is ever needed to rent), so the majority of
// customers receiving a T-04 email have no account at all. Gating the review
// form behind a sign-in would put it out of reach of most of the people
// being asked for a review.
//
// KNOWN LIMITATION, stated rather than hidden: booking references are
// sequential (TCR-0001, TCR-0002...), so they are guessable by enumeration.
// The guards below mean a guesser could at worst leave one review against a
// completed booking that is not theirs. This is the same underlying issue
// already flagged on the rental-agreement download route, and it has the
// same real fix: switch the public-facing identifier to a non-sequential
// value (UUID or random slug), keeping the human-friendly TCR-#### number
// for internal and admin display only. Worth doing before this handles real
// customer data; noted here so it is a recorded decision rather than an
// oversight.
// ============================================================================

const reviewSchema = z.object({
  bookingRef: z.string().trim().min(1, "Booking reference is required"),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Select a rating from 1 to 5")
    .max(5, "Select a rating from 1 to 5"),
  comment: z
    .string()
    .trim()
    .max(500, "Comment is too long (500 characters maximum)")
    .optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid review" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: parsed.data.bookingRef },
    include: { review: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Only a finished rental can be reviewed — reviewing a booking that hasn't
  // happened yet would be meaningless, and it also narrows what a guessed
  // reference could reach.
  if (booking.bookingStatus !== "COMPLETED") {
    return NextResponse.json(
      { error: "This rental isn't complete yet, so it can't be reviewed." },
      { status: 409 }
    );
  }

  if (booking.review) {
    return NextResponse.json(
      { error: "A review has already been submitted for this booking." },
      { status: 409 }
    );
  }

  const review = await prisma.review.create({
    data: {
      bookingId: booking.bookingId,
      customerId: booking.customerId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
  });

  return NextResponse.json({ submitted: true, reviewId: review.reviewId });
}
