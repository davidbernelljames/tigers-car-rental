// DRAFT CONTENT NOTICE (do not remove before deployment sign-off):
// This page is placeholder legal-style text, grounded in what the system
// actually collects and does today (Supabase Auth, Prisma/Postgres storage,
// WiPay for payments, Resend for email, private Supabase Storage for rental
// agreement PDFs). It is NOT reviewed or approved by a lawyer and must not be
// treated as final legal text — Kadesh (and ideally a real legal reviewer)
// should review and approve before this goes live.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-neutral-400 mb-8">
        Draft — pending review. Last updated August 2026.
      </p>

      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-neutral-600 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            1. Information We Collect
          </h2>
          <p>
            When you make a booking we collect your name, email address,
            telephone number, home address, and driving permit number. The
            driving permit number is required to confirm eligibility to drive
            and is checked against the document you present at vehicle
            collection. If you create an account, we also store the email
            address associated with it. Messages sent through our Contact form
            include your name, email address, and the content of your message.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            2. Payment Information
          </h2>
          <p>
            Payments are processed by WiPay, a third-party payment provider. We
            do not receive or store your card number, expiry date, or security
            code. We retain only the outcome of each transaction, the amount,
            and the reference WiPay returns, so that your booking and any refund
            due can be reconciled.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            3. How We Use Your Information
          </h2>
          <p>
            Your information is used to process and confirm bookings, produce
            your rental agreement, verify eligibility at vehicle collection,
            contact you about your rental, and respond to enquiries. We do not
            sell your personal information, and we do not use it for
            advertising.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            4. Your Rental Agreement
          </h2>
          <p>
            The rental agreement generated for each booking contains your
            personal details and driving permit number. It is stored in a
            private location and is not publicly accessible. Download links
            issued for it are time-limited and expire automatically.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            5. Accounts &amp; Authentication
          </h2>
          <p>
            Customer accounts are managed through Supabase Auth. Your password
            is never visible to us in plain text and is never stored by us
            directly. Creating an account requires confirming your email
            address before it becomes active, which prevents someone from
            registering an account using an email address that is not theirs.
            If you booked as a guest and later create an account using the
            same email address, your existing bookings are linked to that
            account so you can view them. If you forget your password, a
            reset link can be requested from the sign-in screen; for
            security, the same confirmation message is shown whether or not
            the email address you enter has an account, so that this process
            cannot be used to check which email addresses are registered.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            6. Finding a Booking Without an Account
          </h2>
          <p>
            A booking made as a guest can be looked up later using the
            booking reference together with the email address it was made
            under. Both must match for any details to be shown — entering a
            booking reference alone is not sufficient to view another
            person&apos;s booking.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            7. Data Retention
          </h2>
          <p>
            Booking and payment records are retained for as long as necessary to
            support your rental history, resolve any dispute, and meet
            applicable legal and accounting obligations.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            8. Access &amp; Correction
          </h2>
          <p>
            You can view your bookings and the details held against them at any
            time through your account, and can update your name, phone number,
            address, and driving permit number directly from your account page
            at any time. Your email address is tied to sign-in and cannot be
            changed there directly — contact us if it needs updating. To
            request deletion of your personal information, contact us using
            the details on our Contact page. Some records may need to be
            retained where we are legally required to keep them.
          </p>
        </section>

        <hr className="border-neutral-200" />

        <p className="text-neutral-500">
          Questions about this policy, or requests regarding your personal
          information? Visit our{" "}
          <a href="/contact" className="text-customer underline">
            Contact page
          </a>
          .
        </p>
      </div>
    </div>
  );
}
