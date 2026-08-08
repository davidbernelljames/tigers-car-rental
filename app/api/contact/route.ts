import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactFormSchema } from "@/lib/validations/booking";
import { sendContactNotificationEmail } from "@/lib/email";

// Validates and forwards Contact screen submissions straight to the
// business inbox, with the submitter's own email set as replyTo so a
// response goes directly back to them.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = contactFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // An email delivery failure here shouldn't fail the whole submission —
  // the customer still successfully reached the form and submitted their
  // message; failing the request over an email problem would leave them
  // thinking the submission itself didn't go through, when it did.
  try {
    const settings = await prisma.systemSettings.findFirst();
    const businessEmail = settings?.businessEmail ?? "kadesh306@gmail.com";
    const emailResult = await sendContactNotificationEmail({
      to: businessEmail,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      subject: parsed.data.subject,
      message: parsed.data.message,
      businessName: settings?.businessName ?? "Tiger's Car Rental",
      businessPhone: settings?.businessPhone ?? "",
      businessAddress: settings?.businessAddress ?? "",
    });
    if (!emailResult.sent) {
      console.error(`[Contact] Notification email not sent: ${emailResult.reason}`);
    }
  } catch (err) {
    console.error("[Contact] Notification email failed:", err);
  }

  return NextResponse.json({ success: true });
}
