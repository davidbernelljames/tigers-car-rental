import { Resend } from "resend";

// ============================================================================
// Transactional email via Resend.
//
// T-01 (Booking Confirmation) is dispatched on payment authorisation, per
// Algorithm A-02 Normal Flow step 8. T-02 (pickup reminders, Algorithm A-03
// via Vercel Cron), T-03 (cancellation) and T-04 (feedback request) are
// implemented further down this file.
//
// Design note: every function here returns a result object rather than
// throwing. Email delivery is a side effect of payment, not part of it — if
// Resend is down or misconfigured, the customer's money has still been taken
// and their booking is still confirmed. Throwing here would fail the callback
// after the payment succeeded, which is the worst possible outcome. The
// caller logs the failure and carries on.
// ============================================================================

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("your-")) return null;
  return new Resend(apiKey);
}

/**
 * The sender address. Resend requires a verified domain for production use;
 * onboarding@resend.dev works for development without domain verification.
 */
function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "Tiger's Car Rental <onboarding@resend.dev>";
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

export interface BookingConfirmationEmailInput {
  to: string;
  customerName: string;
  bookingRef: string;
  vehicleDescription: string;
  pickupDate: string;
  returnDate: string;
  totalCost: number;
  amountPaid: number;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  /** Rental agreement PDF, attached when generation succeeded. */
  agreementPdf?: Buffer;
}

/** T-01: Booking Confirmation email, sent on payment authorisation. */
export async function sendBookingConfirmationEmail(
  input: BookingConfirmationEmailInput
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }


  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#181614;padding:24px;">
              <div style="font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                TIGER'S <span style="color:#E5843B;">CAR RENTAL</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 4px;font-size:14px;color:#666;">Booking Confirmed</p>
              <p style="margin:0 0 20px;font-size:26px;font-weight:bold;">${input.bookingRef}</p>

              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
                Hi ${input.customerName}, your payment has been received and your
                booking is confirmed. Your rental agreement is attached to this email.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:6px;padding:16px;font-size:14px;">
                <tr><td style="padding:4px 0;color:#666;width:140px;">Vehicle</td><td style="padding:4px 0;">${input.vehicleDescription}</td></tr>
                <tr><td style="padding:4px 0;color:#666;">Pickup</td><td style="padding:4px 0;">${input.pickupDate}</td></tr>
                <tr><td style="padding:4px 0;color:#666;">Return</td><td style="padding:4px 0;">${input.returnDate}</td></tr>
                <tr><td style="padding:4px 0;color:#666;">Total</td><td style="padding:4px 0;">TT$${input.totalCost.toFixed(2)}</td></tr>
                <tr><td style="padding:4px 0;color:#666;">Paid in Full</td><td style="padding:4px 0;font-weight:bold;">TT$${input.amountPaid.toFixed(2)}</td></tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#555;">
                Please bring the driving permit you provided at booking when you
                collect the vehicle. Your rental is paid in full — there is
                nothing further to pay at pickup.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;background:#fafafa;font-size:12px;color:#888;line-height:1.6;">
              ${input.businessName}<br/>
              ${input.businessAddress}<br/>
              ${input.businessPhone}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: `Booking Confirmed — ${input.bookingRef} | ${input.businessName}`,
      html,
      attachments: input.agreementPdf
        ? [
            {
              filename: `Rental-Agreement-${input.bookingRef}.pdf`,
              content: input.agreementPdf,
            },
          ]
        : undefined,
    });

    if (error) {
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

// ============================================================================
// Shared email shell (T-02, T-03, T-04)
//
// T-01 above predates these and keeps its own inline markup — it was built
// and verified in Phase 3, and rewriting working, tested code purely for
// tidiness risks breaking the one email path that is known good. New
// triggers share this helper so the remaining three cannot drift apart.
// ============================================================================

interface ShellOptions {
  heading: string;
  headingSub?: string;
  bodyHtml: string;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
}

function emailShell(o: ShellOptions): string {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#181614;padding:24px;">
              <div style="font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                TIGER'S <span style="color:#E5843B;">CAR RENTAL</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              ${o.headingSub ? `<p style="margin:0 0 4px;font-size:14px;color:#666;">${o.headingSub}</p>` : ""}
              <p style="margin:0 0 20px;font-size:22px;font-weight:bold;">${o.heading}</p>
              ${o.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;background:#fafafa;font-size:12px;color:#888;line-height:1.6;">
              ${o.businessName}<br/>
              ${o.businessAddress}<br/>
              ${o.businessPhone}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();
}

/** Business details every trigger email needs in its footer. */
export interface BusinessDetails {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
}

// ============================================================================
// Contact screen submission notification.
//
// [Corrected] This previously only wrote the submission to a server log —
// harmless while Resend wasn't configured at all, but once email delivery
// was confirmed working elsewhere in the system, a contact form that
// silently goes nowhere is a real gap, not just an unfinished stub. Sends
// straight to the business's own inbox (SystemSettings.businessEmail),
// with the submitter's email set as replyTo so a reply goes directly to
// them without needing to copy an address out of the email body.
// ============================================================================

export interface ContactNotificationEmailInput extends BusinessDetails {
  to: string;
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export async function sendContactNotificationEmail(
  input: ContactNotificationEmailInput
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      A new message came in through the Contact screen.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:6px;padding:16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#666;width:100px;">From</td><td style="padding:4px 0;">${input.fullName}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Email</td><td style="padding:4px 0;">${input.email}</td></tr>
      ${input.phone ? `<tr><td style="padding:4px 0;color:#666;">Phone</td><td style="padding:4px 0;">${input.phone}</td></tr>` : ""}
      <tr><td style="padding:4px 0;color:#666;">Subject</td><td style="padding:4px 0;">${input.subject}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${input.message}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#888;">
      Reply directly to this email to respond to ${input.fullName}.
    </p>`;

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      replyTo: input.email,
      subject: `Contact Form — ${input.subject}`,
      html: emailShell({
        heading: input.subject,
        headingSub: "New Contact Message",
        bodyHtml,
        businessName: input.businessName,
        businessPhone: input.businessPhone,
        businessAddress: input.businessAddress,
      }),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// T-02: Automated Booking Reminder (Algorithm A-03, via Vercel Cron)
// ---------------------------------------------------------------------------

export interface PickupReminderInput extends BusinessDetails {
  to: string;
  customerName: string;
  bookingRef: string;
  vehicleDescription: string;
  pickupDate: string;
  returnDate: string;
  /** Which reminder window this is — SS1 A-03 specifies both 48hr and 24hr. */
  window: 24 | 48;
}

/**
 * T-02: pickup reminder, sent at both the 48-hour and 24-hour marks.
 *
 * The two windows share one function rather than being separate emails: the
 * content differs only in urgency wording, and splitting them would mean two
 * near-identical templates drifting apart over time.
 */
export async function sendPickupReminderEmail(
  input: PickupReminderInput
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const isFinal = input.window === 24;
  const timing = isFinal ? "tomorrow" : "in two days";

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
      Hi ${input.customerName}, this is a reminder that your rental starts
      ${timing}. Everything is confirmed and paid — there is nothing further
      to pay at pickup.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:6px;padding:16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#666;width:140px;">Booking</td><td style="padding:4px 0;font-weight:bold;">${input.bookingRef}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Vehicle</td><td style="padding:4px 0;">${input.vehicleDescription}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Pickup</td><td style="padding:4px 0;font-weight:bold;">${input.pickupDate}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Return</td><td style="padding:4px 0;">${input.returnDate}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#555;">
      Please bring the driving permit you provided when booking. If anything
      has changed, contact us as early as you can.
    </p>`;

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: isFinal
        ? `Your rental starts tomorrow — ${input.bookingRef}`
        : `Reminder: your rental starts in 2 days — ${input.bookingRef}`,
      html: emailShell({
        heading: input.bookingRef,
        headingSub: isFinal ? "Pickup Tomorrow" : "Pickup in 2 Days",
        bodyHtml,
        businessName: input.businessName,
        businessPhone: input.businessPhone,
        businessAddress: input.businessAddress,
      }),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

// ---------------------------------------------------------------------------
// T-03: Cancellation Notification
// ---------------------------------------------------------------------------

export interface CancellationEmailInput extends BusinessDetails {
  to: string;
  customerName: string;
  bookingRef: string;
  vehicleDescription: string;
  pickupDate: string;
  /** Retained cancellation fee, 0 when cancelled inside the free window. */
  cancellationFee: number;
  /** Amount owed back to the customer. */
  refundDue: number;
  /** Plain-language explanation of which side of the window this fell on. */
  policyNote: string;
}

/**
 * T-03: cancellation confirmation, sent whether the customer cancelled
 * themselves or an admin did it on their behalf — both paths run through
 * /api/booking/cancel, so both produce this email.
 *
 * States the refund honestly rather than implying it is automatic: WiPay
 * provides no programmatic reversal, so Kadesh issues it by hand from the
 * merchant dashboard. Promising an instant refund here would set an
 * expectation the system cannot keep.
 */
export async function sendCancellationEmail(
  input: CancellationEmailInput
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const refundBlock =
    input.refundDue > 0
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:6px;padding:16px;font-size:14px;margin-top:4px;">
      ${
        input.cancellationFee > 0
          ? `<tr><td style="padding:4px 0;color:#666;width:160px;">Cancellation fee</td><td style="padding:4px 0;">TT$${input.cancellationFee.toFixed(2)}</td></tr>`
          : ""
      }
      <tr><td style="padding:4px 0;color:#666;">Refund due to you</td><td style="padding:4px 0;font-weight:bold;">TT$${input.refundDue.toFixed(2)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#555;">
      Your refund is processed manually and typically reaches your account
      within 3–5 business days.
    </p>`
      : `
    <p style="margin:0;font-size:13px;line-height:1.6;color:#555;">
      No payment had been taken for this booking, so there is nothing to refund.
    </p>`;

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
      Hi ${input.customerName}, your booking has been cancelled and the
      vehicle released.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:6px;padding:16px;font-size:14px;margin-bottom:16px;">
      <tr><td style="padding:4px 0;color:#666;width:160px;">Vehicle</td><td style="padding:4px 0;">${input.vehicleDescription}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Original pickup</td><td style="padding:4px 0;">${input.pickupDate}</td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#555;">${input.policyNote}</p>
    ${refundBlock}`;

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: `Booking Cancelled — ${input.bookingRef}`,
      html: emailShell({
        heading: input.bookingRef,
        headingSub: "Booking Cancelled",
        bodyHtml,
        businessName: input.businessName,
        businessPhone: input.businessPhone,
        businessAddress: input.businessAddress,
      }),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

// ---------------------------------------------------------------------------
// T-04: Post-Rental Feedback Request
// ---------------------------------------------------------------------------

export interface FeedbackRequestInput extends BusinessDetails {
  to: string;
  customerName: string;
  bookingRef: string;
  vehicleDescription: string;
  /** Absolute URL to the review form — must work without a login. */
  reviewUrl: string;
}

/**
 * T-04: feedback request, sent when an admin marks a rental Completed.
 *
 * The review link deliberately works without a login. Guest checkout means
 * most customers have no account at all, so requiring one here would put the
 * review form out of reach of the majority of the people being asked for a
 * review.
 */
export async function sendFeedbackRequestEmail(
  input: FeedbackRequestInput
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
      Hi ${input.customerName}, thank you for renting the
      ${input.vehicleDescription} from us. If you have a moment, we would
      appreciate a quick rating — it takes less than a minute and helps us
      improve.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:#E5843B;border-radius:6px;">
          <a href="${input.reviewUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">
            Leave a Review
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#888;">
      If the button doesn't work, paste this into your browser:<br/>
      <span style="color:#666;">${input.reviewUrl}</span>
    </p>`;

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: `How was your rental? — ${input.bookingRef}`,
      html: emailShell({
        heading: "How did we do?",
        headingSub: input.bookingRef,
        bodyHtml,
        businessName: input.businessName,
        businessPhone: input.businessPhone,
        businessAddress: input.businessAddress,
      }),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

// ---------------------------------------------------------------------------
// Algorithm A-05: Rental Extension confirmation
// ---------------------------------------------------------------------------

export interface ExtensionConfirmationInput extends BusinessDetails {
  to: string;
  customerName: string;
  bookingRef: string;
  vehicleDescription: string;
  newReturnDate: string;
  additionalDays: number;
  additionalCost: number;
}

/**
 * Sent once an extension payment (Algorithm A-05) is confirmed. Deliberately
 * a distinct template from T-01's booking confirmation — reusing that one
 * with adjusted wording would risk it reading like a brand new booking
 * confirmation rather than an update to an existing one.
 */
export async function sendExtensionConfirmationEmail(
  input: ExtensionConfirmationInput
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
      Hi ${input.customerName}, your rental extension has been confirmed and paid.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:6px;padding:16px;font-size:14px;">
      <tr><td style="padding:4px 0;color:#666;width:160px;">Booking</td><td style="padding:4px 0;font-weight:bold;">${input.bookingRef}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Vehicle</td><td style="padding:4px 0;">${input.vehicleDescription}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">New Return Date</td><td style="padding:4px 0;font-weight:bold;">${input.newReturnDate}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Additional Days</td><td style="padding:4px 0;">${input.additionalDays}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Additional Amount Paid</td><td style="padding:4px 0;">TT$${input.additionalCost.toFixed(2)}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#555;">
      An updated rental agreement reflecting your new return date is attached.
    </p>`;

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: `Rental Extended — ${input.bookingRef}`,
      html: emailShell({
        heading: input.bookingRef,
        headingSub: "Rental Extension Confirmed",
        bodyHtml,
        businessName: input.businessName,
        businessPhone: input.businessPhone,
        businessAddress: input.businessAddress,
      }),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}
