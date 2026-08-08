import type { BookingStatus, TransactionStatus } from "@prisma/client";

// ============================================================================
// Payment outcome resolution — SS1 Decision Table (Section 6.5), Algorithm A-02
//
// The SS1 Decision Table defines six conditions resolving to four outcome
// states:
//
//   Condition                                    -> Outcome
//   1. Gateway returns authorisation success     -> Payment Authorised
//   2. Gateway returns decline                   -> Payment Declined
//   3. Gateway timeout (no response in 30s)      -> Booking Pending (10 min)
//   4. No retry within the 10-minute hold        -> Booking Cancelled
//   5. Retry, authorisation succeeds             -> Payment Authorised
//   6. Retry, authorisation fails again          -> Booking Cancelled
//
// Conditions 5 and 6 are distinguished from 1 and 2 by whether a prior
// PaymentTransaction already exists for the booking — that prior attempt is
// what makes the current one a "retry". This is why resolvePaymentOutcome()
// takes priorAttemptCount rather than trying to infer it from the payload:
// WiPay's callback has no notion of "this is a retry", so the distinction
// has to come from our own transaction history.
//
// Note the asymmetry between outcomes 2 and 6, taken directly from the
// Pseudocode document's postconditions: a FIRST decline keeps the booking
// Pending so the customer can try another card, whereas a SECOND decline
// cancels the booking and releases the vehicle. Getting this backwards would
// either strand vehicles on abandoned bookings or cut customers off after a
// single mistyped CVV.
// ============================================================================

export type DecisionTableOutcome =
  | "AUTHORISED"
  | "DECLINED"
  | "TIMEOUT"
  | "HOLD_EXPIRED"
  | "RETRY_AUTHORISED"
  | "RETRY_DECLINED";

export interface PaymentOutcome {
  /** Which of the six Decision Table outcomes this is. */
  outcome: DecisionTableOutcome;
  /** Outcome number as documented in Pseudocode A-02 postconditions (1-6). */
  outcomeNumber: number;
  /** Status to persist on the PaymentTransaction record. */
  transactionStatus: TransactionStatus;
  /** Status the Booking should transition to. */
  bookingStatus: BookingStatus;
  /** Whether a rental agreement PDF + confirmation email should be issued. */
  issueAgreement: boolean;
  /** Customer-facing message. */
  customerMessage: string;
  /** Where the customer's browser should be sent afterwards. */
  redirectTo: "confirmation" | "payment" | "vehicles";
}

/** The 10-minute reservation hold from the SS1 Decision Table, in milliseconds. */
export const HOLD_WINDOW_MS = 10 * 60 * 1000;

/**
 * Maps a WiPay callback result onto the SS1 Decision Table.
 *
 * @param wipayStatus   The `status` response parameter: success | failed | error
 * @param message       The `message` response parameter, used to detect timeouts
 * @param priorAttempts Count of existing PaymentTransaction rows for this booking
 */
export function resolvePaymentOutcome(
  wipayStatus: string | undefined,
  message: string | undefined,
  priorAttempts: number
): PaymentOutcome {
  const status = (wipayStatus ?? "").toLowerCase();
  const isRetry = priorAttempts > 0;

  // --- Outcomes 1 & 5: authorisation succeeded ---
  if (status === "success") {
    return isRetry
      ? {
          outcome: "RETRY_AUTHORISED",
          outcomeNumber: 5,
          transactionStatus: "RETRY_AUTHORISED",
          bookingStatus: "CONFIRMED",
          issueAgreement: true,
          customerMessage: "Payment successful. Your booking is confirmed.",
          redirectTo: "confirmation",
        }
      : {
          outcome: "AUTHORISED",
          outcomeNumber: 1,
          transactionStatus: "AUTHORISED",
          bookingStatus: "CONFIRMED",
          issueAgreement: true,
          customerMessage: "Payment successful. Your booking is confirmed.",
          redirectTo: "confirmation",
        };
  }

  // --- Outcome 3: gateway timeout ---
  // WiPay reports `error` for gateway-side problems; we additionally treat an
  // explicit timeout mention as a timeout regardless of status, since the
  // Decision Table distinguishes a timeout from an outright decline: a timeout
  // keeps the booking alive on its hold, a decline may end it.
  const looksLikeTimeout =
    status === "error" || /timeout|timed out|no response/i.test(message ?? "");

  if (looksLikeTimeout) {
    return {
      outcome: "TIMEOUT",
      outcomeNumber: 3,
      transactionStatus: "TIMEOUT",
      bookingStatus: "PENDING",
      issueAgreement: false,
      customerMessage:
        "The payment gateway did not respond in time. Your booking is still held — please try again.",
      redirectTo: "payment",
    };
  }

  // --- Outcomes 2 & 6: declined ---
  // First decline keeps the booking Pending so another card can be tried.
  // Second decline cancels and releases the vehicle (Pseudocode A-02,
  // Outcome 6).
  return isRetry
    ? {
        outcome: "RETRY_DECLINED",
        outcomeNumber: 6,
        transactionStatus: "RETRY_DECLINED",
        bookingStatus: "CANCELLED",
        issueAgreement: false,
        customerMessage:
          "This payment was declined again, so the booking has been released. Please choose a vehicle to start a new booking.",
        redirectTo: "vehicles",
      }
    : {
        outcome: "DECLINED",
        outcomeNumber: 2,
        transactionStatus: "DECLINED",
        bookingStatus: "PENDING",
        issueAgreement: false,
        customerMessage:
          "Your payment was declined. Your booking is still held — you can try a different payment method.",
        redirectTo: "payment",
      };
}

/**
 * Outcome 4: the 10-minute hold lapsed with no successful payment or retry.
 *
 * This is the one Decision Table outcome that is NOT triggered by a WiPay
 * callback — nothing arrives, which is precisely the condition. It is
 * evaluated lazily: whenever a Pending booking is next looked at, if its hold
 * window has elapsed it is treated as cancelled.
 *
 * Lazy evaluation is deliberate. A scheduled sweep on Vercel's Hobby tier can
 * only run once daily, which would leave vehicles reserved for up to 24 hours
 * after an abandoned checkout — far worse than the 10 minutes specified. A
 * background timer would not survive serverless invocation boundaries. Lazy
 * expiry gives exactly the specified behaviour at the moments it actually
 * matters: when availability is queried, or when the booking is next touched.
 */
export function isHoldExpired(booking: {
  bookingStatus: BookingStatus;
  createdAt: Date;
}): boolean {
  if (booking.bookingStatus !== "PENDING") return false;
  return Date.now() - booking.createdAt.getTime() > HOLD_WINDOW_MS;
}

export const HOLD_EXPIRED_OUTCOME: PaymentOutcome = {
  outcome: "HOLD_EXPIRED",
  outcomeNumber: 4,
  transactionStatus: "TIMEOUT",
  bookingStatus: "CANCELLED",
  issueAgreement: false,
  // Pseudocode A-02, Outcome 4: the reservation lapses "without triggering
  // an email" — the customer simply abandoned checkout.
  customerMessage:
    "This booking's 10-minute reservation window expired and the vehicle has been released.",
  redirectTo: "vehicles",
};
