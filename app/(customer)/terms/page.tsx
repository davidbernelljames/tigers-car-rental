// DRAFT CONTENT NOTICE (do not remove before deployment sign-off):
// This page is placeholder legal-style text, grounded in what the system
// actually does today (full prepayment, the cancellation window and fee held
// in SystemSettings) and in the clauses on Kadesh's real paper Car Rental
// Form. It is NOT reviewed or approved by a lawyer and must not be treated as
// final legal text — Kadesh (and ideally a real legal reviewer) should review
// and approve before this goes live, the same way the About page's history
// content is flagged pending verification.
//
// SCOPE NOTE: this page deliberately does NOT restate the operational detail
// covered on /faq (fuel levels, grace periods, what to bring). Terms states
// the contractual position; the FAQ explains day-to-day practice. Keeping the
// two separate avoids maintaining the same policy in two places, where they
// would eventually disagree.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-neutral-400 mb-8">
        Draft — pending review. Last updated August 2026.
      </p>

      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-neutral-600 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            1. Booking &amp; Payment
          </h2>
          <p>
            The full rental amount is payable online at the time of booking and
            is processed by our payment provider, WiPay. A booking is confirmed
            only once payment has been authorised. We do not receive or store
            card details. No further rental payment is due at vehicle
            collection. All rentals require a minimum booking length of 2 days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            2. Cancellations &amp; Refunds
          </h2>
          <p>
            Bookings cancelled more than 48 hours before the scheduled pickup
            date are refunded in full. Bookings cancelled within 48 hours of the
            pickup date are subject to a cancellation fee of 25% of the rental
            total, with the remaining balance refunded. Refunds are issued to
            the original payment method and are typically processed within 3–5
            business days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            3. Rental Extensions
          </h2>
          <p>
            A renter who requires the vehicle beyond the agreed return date
            must request an extension before that date, subject to the
            vehicle&apos;s availability for the additional period. An
            extension granted under this clause is charged at the
            vehicle&apos;s normal daily rate as a continuation of the rental,
            and is processed as a separate payment. A vehicle already booked
            by another customer for any part of the requested extension
            period must be returned by the originally agreed date; the late
            return provisions of Clause 6 apply to any period beyond that
            date for which no extension was granted.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            4. Driver Eligibility
          </h2>
          <p>
            The driver must be 25 years of age or older and must hold a valid
            driving licence for a minimum of two years. The driving permit
            number provided at booking must correspond to the document
            presented at vehicle collection, and the driver must be the person
            named on the booking.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            5. Use of the Vehicle
          </h2>
          <p>
            The vehicle may be driven only on properly formed roadways. The
            renter shall not drive under the influence of alcohol or any
            controlled substance, shall not use the vehicle for any unlawful
            purpose, shall not leave it unattended while unlocked, and shall not
            exceed its seating capacity, modify it, or add or remove any part or
            accessory.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            6. Condition, Damage &amp; Late Return
          </h2>
          <p>
            The vehicle must be returned in the condition in which it was
            received, ordinary wear excepted, and at the same fuel level. Where
            the vehicle is damaged, the renter is responsible for the full cost
            of restoring it to that condition; where it is beyond economical
            repair, the renter is responsible for its full value. Vehicles
            returned beyond the agreed return time, after a 1-hour grace
            period, are subject to a flat late fee of TT$100.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            7. Liability &amp; Indemnity
          </h2>
          <p>
            The renter agrees to indemnify and hold harmless the owner against
            any loss, damage, or legal action arising from the renter&apos;s use
            of the vehicle during the rental period, including reasonable legal
            costs. The renter is responsible for any parking, traffic, or other
            citations incurred while the vehicle is in their possession.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            8. Breakdown, Accident &amp; Theft
          </h2>
          <p>
            The renter must notify us immediately of any breakdown, defect, or
            fault, and must not continue to operate a vehicle that is not
            roadworthy. Any accident, theft, or other incident involving the
            vehicle must also be reported to the nearest Police Station without
            delay.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-2">
            9. Changes to These Terms
          </h2>
          <p>
            These terms may be updated from time to time. The terms in force are
            those presented at the time a booking is made, and a copy is
            included with the rental agreement issued for that booking.
          </p>
        </section>

        <hr className="border-neutral-200" />

        <p className="text-neutral-500">
          Day-to-day questions are answered on our{" "}
          <a href="/faq" className="text-customer underline">
            FAQ page
          </a>
          . For anything else, visit our{" "}
          <a href="/contact" className="text-customer underline">
            Contact page
          </a>
          .
        </p>
      </div>
    </div>
  );
}
