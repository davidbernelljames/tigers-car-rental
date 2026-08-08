// ============================================================================
// FAQ content.
//
// SOURCING NOTE: entries marked [FORM] are taken directly from the clauses on
// Kadesh's real paper Car Rental Form (DRIVER, VEHICLE USE, RENTAL
// COMPENSATION, and the breakdown/accident obligation), which SS1 lists as a
// document-analysis source. Entries marked [SYSTEM] describe how the online
// booking system itself behaves. Nothing here is invented business policy —
// where a question could only be answered by Kadesh (walk-in availability,
// exact no-show handling), it is deliberately absent rather than guessed.
//
// A "how do I contact you" entry was deliberately removed: contact details
// already appear in the header nav, the footer, and the call-to-action at the
// foot of the FAQ page. Repeating them a fourth time here duplicated content
// and created another place for phone numbers to go stale.
//
// This file is the single source of truth for both the homepage teaser and
// the full /faq page, so the two cannot drift apart.
// ============================================================================

export interface FaqItem {
  q: string;
  a: string;
  category: "Booking & Payment" | "Driver Requirements" | "During Your Rental";
}

export const FAQS: FaqItem[] = [
  // --- Booking & Payment ---
  {
    category: "Booking & Payment",
    q: "How far in advance should I book?",
    a: "At least 48 hours ahead where possible, especially during Carnival season when demand is highest. Availability is shown in real time for the dates you enter.",
  },
  {
    // [SYSTEM]
    category: "Booking & Payment",
    q: "Is there a minimum rental period?",
    a: "Yes — all rentals require a minimum of 2 days.",
  },
  {
    // [SYSTEM]
    category: "Booking & Payment",
    q: "How do I pay, and when?",
    a: "The full rental is paid online when you book, through WiPay's secure payment page. We accept credit and debit cards. No card details are entered or stored on this site, and there is nothing further to pay at pickup.",
  },
  {
    // [SYSTEM]
    category: "Booking & Payment",
    q: "Do I need to create an account to book?",
    a: "No. You can complete a full booking — including payment — with just your name, contact details, and driving permit number, and no password is ever required. Creating an account is entirely optional, and only useful if you want to see your booking history in one place next time. Booked as a guest and need to check your booking later? Use Find My Booking with your booking reference and email — no account needed. If you later decide to create an account using the same email address, your past bookings are automatically linked to it.",
  },
  {
    // [SYSTEM] — mirrors SystemSettings.fullRefundWindowHours / cancellationFeePercent
    category: "Booking & Payment",
    q: "What if I need to cancel?",
    a: "You can cancel a booking yourself at any time before pickup, whether you have an account or booked as a guest — through Find My Booking or your account, whichever you used originally. Cancel more than 48 hours before your pickup date and you receive a full refund. Cancellations made within 48 hours of pickup are subject to a 25% cancellation fee, with the balance refunded. Refunds are processed within 3–5 business days.",
  },
  {
    // [SYSTEM] — Algorithm A-05, Rental Extension Request
    category: "Booking & Payment",
    q: "What if I need the vehicle for longer than planned?",
    a: "Request an extension yourself through Find My Booking or your account, before your scheduled return date. We'll check whether the vehicle is free for the extra days; if it is, you'll be able to pay for the extension at the vehicle's normal daily rate — not the late fee, which only applies to an unarranged late return. If the vehicle is already booked by someone else for those dates, it must be returned as originally agreed.",
  },

  // --- Driver Requirements ---
  {
    // [FORM] DRIVER clause
    category: "Driver Requirements",
    q: "What are the driver requirements?",
    a: "The driver must be 25 years or older and must hold a valid licence under the Republic of Trinidad and Tobago for a minimum of 2 years.",
  },
  {
    // [FORM] DRIVING PERMIT# field
    category: "Driver Requirements",
    q: "What do I need to bring at pickup?",
    a: "The driving permit you entered when booking. Visiting from overseas? Enter your licence or International Driving Permit number when you book, and bring that same document with you.",
  },

  // --- During Your Rental ---
  {
    // [FORM] fuel field
    category: "During Your Rental",
    q: "How does the fuel policy work?",
    a: "We record the fuel level when you collect the vehicle, and you return it at that same level. There is no separate fuel charge — you simply replace what you use.",
  },
  {
    // [SYSTEM] — SystemSettings.lateReturnGraceHours + lateFeeAmount
    category: "During Your Rental",
    q: "What happens if I return the vehicle late?",
    a: "There is a 1-hour grace period after your scheduled return time. Beyond that, a flat late fee of TT$100 applies. If you know you will be delayed, contact us as early as you can.",
  },
  {
    // [FORM] VEHICLE USE clause
    category: "During Your Rental",
    q: "Where can I drive the vehicle?",
    a: "On properly formed roadways only — not on gravel, stone, or sand roads. The vehicle must never be left unattended while unlocked or abandoned, must not be driven under the influence of alcohol or any controlled substance, and must not be used for illegal activity. Do not overload the vehicle beyond its seating capacity or modify it in any way.",
  },
  {
    // [FORM] breakdown / accident / theft clause
    category: "During Your Rental",
    q: "What should I do if the vehicle breaks down or I have an accident?",
    a: "Contact us immediately, and do not continue driving a vehicle in unsafe condition. Any accident, theft, or incident involving the vehicle must also be reported to the nearest Police Station straight away.",
  },
  {
    // [FORM] RENTAL COMPENSATION clause
    category: "During Your Rental",
    q: "What am I responsible for if the vehicle is damaged?",
    a: "The vehicle must be returned in the same condition it was received. If it is damaged, the renter is responsible for the full cost of repair to that same standard; if the vehicle is written off, the renter is responsible for its full value. Damage is assessed when the vehicle is returned.",
  },

];

/** The short teaser shown on the homepage, linking through to the full page. */
export const HOMEPAGE_FAQS: FaqItem[] = [
  FAQS.find((f) => f.q.startsWith("Do I need to create an account"))!,
  FAQS.find((f) => f.q.startsWith("What are the driver"))!,
  FAQS.find((f) => f.q.startsWith("What if I need to cancel"))!,
];

export const FAQ_CATEGORIES: FaqItem["category"][] = [
  "Booking & Payment",
  "Driver Requirements",
  "During Your Rental",
];
