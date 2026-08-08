import { z } from "zod";
import { validatePhone, digitsOnly } from "@/lib/phone";

// ============================================================================
// Form validation schemas.
//
// SANITISATION PRINCIPLE: every string field is trimmed BEFORE its rules are
// applied. Without this, a `min(1)` check passes on a single space — the field
// looks filled to the validator and empty to a human, and the blank lands in
// the database and on the printed rental agreement.
//
// Character-set rules are deliberately permissive where the data is genuinely
// varied (addresses, permit numbers from any country) and strict only where
// the shape is predictable (names, phone digits). Over-restricting a field
// like address locks out legitimate customers, which is a worse failure than
// accepting an unusual-looking one.
// ============================================================================

/** Trims, then collapses runs of internal whitespace to single spaces. */
const cleaned = () =>
  z.string().transform((v) => v.trim().replace(/\s+/g, " "));

// Letters (including accented), spaces, apostrophes, and hyphens. Covers
// names like O'Brien, Jean-Luc, and María without accepting "12345".
const NAME_PATTERN = /^[\p{L}][\p{L}\s'’.-]*$/u;

// S4: Booking Details form — validates FR-04 (customer details) and
// FR-05 (driving permit verification) prior to advancing to payment (S5).
// Addresses Usability Report Finding 5: "Implement Client-Side Validation."
export const bookingDetailsSchema = z
  .object({
    firstName: cleaned()
      .pipe(
        z
          .string()
          .min(2, "First name must be at least 2 characters")
          .max(50, "First name is too long")
          .regex(NAME_PATTERN, "First name can only contain letters, spaces, hyphens and apostrophes")
      ),
    lastName: cleaned()
      .pipe(
        z
          .string()
          .min(2, "Last name must be at least 2 characters")
          .max(50, "Last name is too long")
          .regex(NAME_PATTERN, "Last name can only contain letters, spaces, hyphens and apostrophes")
      ),
    // Lowercased as well as trimmed: email is the key we upsert Customer
    // records on, so "Test@x.com" and "test@x.com" must not create two
    // separate customers for the same person.
    email: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .pipe(
        z
          .string()
          .min(1, "Email is required")
          .email("Enter a valid email address")
          .max(100, "Email is too long")
      ),
    // Phone is captured as a country selection plus the local number, then
    // normalised to E.164 before storage and before being sent to WiPay — see
    // lib/phone.ts for why. Validating per-country digit counts here surfaces
    // typos on our own form rather than at WiPay's checkout, where a rejection
    // lands after the customer has already committed to paying.
    phoneCountry: z.string().min(1, "Select a country"),
    phone: cleaned().pipe(z.string().min(1, "Phone number is required")),
    // [Extension, form-derived] Matches the ADDRESS field on Kadesh's real
    // paper Car Rental Form — required there, required here too.
    //
    // Character rules kept loose on purpose: addresses legitimately contain
    // digits, commas, hashes, slashes and apostrophes ("#1 St. Vincent St.,
    // Port of Spain"). The meaningful check is that it is long enough to be
    // a real address rather than a stray character.
    address: cleaned().pipe(
      z
        .string()
        .min(5, "Enter a full address")
        .max(255, "Address is too long")
    ),
    // [Form-derived] Single free-text field matching "DRIVING PERMIT#" on the
    // real Car Rental Form. Free text accommodates a T&T permit, a foreign
    // licence, or an International Driving Permit without the system asserting
    // a policy about which is acceptable — Kadesh rents to overseas visitors on
    // the same terms as locals.
    //
    // Uppercased for consistency, since permit numbers are conventionally
    // written that way and this value is printed on the agreement. Only
    // alphanumerics, hyphens and spaces are allowed — enough for every
    // real-world format, but it rejects a sentence typed into the box.
    drivingPermitNumber: z
      .string()
      .transform((v) => v.trim().replace(/\s+/g, " ").toUpperCase())
      .pipe(
        z
          .string()
          .min(4, "Enter your full driving permit number")
          .max(50, "Driving permit number is too long")
          .regex(
            /^[A-Z0-9][A-Z0-9\s-]*$/,
            "Permit number can only contain letters, numbers and hyphens"
          )
      ),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms and Conditions" }),
    }),
  })
  // Digit-count validation is a cross-field check: how many digits are
  // correct depends on which country was selected, so it cannot live on the
  // phone field alone.
  .refine((data) => validatePhone(data.phoneCountry, data.phone).valid, {
    message: "Enter a valid phone number for the selected country",
    path: ["phone"],
  });

export type BookingDetailsInput = z.infer<typeof bookingDetailsSchema>;

/** Midnight today, for comparing date-only values without time-of-day noise. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parses a yyyy-mm-dd value as a local date, or null if unparseable. */
function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects impossible dates that Date would otherwise roll over (e.g.
  // 2026-02-31 becoming 3 March).
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Longest rental the form will accept, as a guard against typos in the year. */
const MAX_RENTAL_DAYS = 90;
// [New — confirmed with Kadesh] All rentals require a minimum 2-day booking.
// Hardcoded as a plain constant rather than a SystemSettings/A9 field,
// matching how MAX_RENTAL_DAYS above is already handled — neither the SIP
// nor the DAR Models specify an admin-configurable minimum, so treating this
// like the existing max-days constant is consistent rather than introducing
// a new, differently-styled business rule.
export const MIN_RENTAL_DAYS = 2;

// S1/S2: Availability search widget
export const availabilitySearchSchema = z
  .object({
    pickupDate: z.string().min(1, "Pickup date is required"),
    returnDate: z.string().min(1, "Return date is required"),
    category: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const pickup = parseDateInput(data.pickupDate);
    const returnD = parseDateInput(data.returnDate);

    if (!pickup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid pickup date",
        path: ["pickupDate"],
      });
      return;
    }
    if (!returnD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid return date",
        path: ["returnDate"],
      });
      return;
    }

    // A date input can be typed into as well as picked from the calendar, so
    // the `min` attribute on the element is not sufficient on its own.
    if (pickup < startOfToday()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup date cannot be in the past",
        path: ["pickupDate"],
      });
    }

    if (returnD <= pickup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Return date must be after pickup date",
        path: ["returnDate"],
      });
      return;
    }

    const days = Math.ceil(
      (returnD.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days < MIN_RENTAL_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Rentals require a minimum of ${MIN_RENTAL_DAYS} days`,
        path: ["returnDate"],
      });
      return;
    }

    if (days > MAX_RENTAL_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `For rentals longer than ${MAX_RENTAL_DAYS} days, please contact us directly`,
        path: ["returnDate"],
      });
    }
  });

export type AvailabilitySearchInput = z.infer<typeof availabilitySearchSchema>;

// Contact screen form
export const contactFormSchema = z.object({
  fullName: cleaned().pipe(
    z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name is too long")
      .regex(NAME_PATTERN, "Name can only contain letters, spaces, hyphens and apostrophes")
  ),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(1, "Email is required")
        .email("Enter a valid email address")
        .max(100, "Email is too long")
    ),
  // Optional here — unlike the booking form, we do not need to reach this
  // person by phone. But if they do supply one, it must be plausible rather
  // than free text, so a mistyped number is caught while they can still fix it.
  phone: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || digitsOnly(v).length >= 7, {
      message: "Enter a valid phone number, or leave this blank",
    })
    .refine((v) => v === "" || digitsOnly(v).length <= 15, {
      message: "Phone number is too long",
    }),
  subject: z.enum(
    ["General Enquiry", "Booking Assistance", "Vehicle Availability", "Feedback"],
    { errorMap: () => ({ message: "Select a subject" }) }
  ),
  message: cleaned().pipe(
    z
      .string()
      .min(10, "Message must be at least 10 characters")
      .max(1000, "Message is too long (1000 characters maximum)")
  ),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

// ============================================================================
// Account sign-up / sign-in (S7 My Account).
//
// Password rules apply to SIGN-UP only. Deliberately not enforced on sign-in:
// an existing customer whose password predates a rule change must still be
// able to log in, and telling someone their correct password "is invalid"
// because it is short would lock them out of their own bookings.
// ============================================================================

/** Shared email normalisation: trimmed and lowercased before validation. */
const normalisedEmail = () =>
  z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(1, "Email is required")
        .email("Enter a valid email address")
        .max(100, "Email is too long")
    );

export const signInSchema = z.object({
  email: normalisedEmail(),
  password: z.string().min(1, "Password is required"),
});

// ============================================================================
// Shared password strength rule — used by both customer sign-up (below) and
// staff account creation (lib/validations/admin.ts), so the two can never
// drift apart on what counts as a strong-enough password.
//
// Requires all four character classes (lowercase, uppercase, digit, symbol),
// matching the Supabase project-level password policy this is meant to stay
// in step with — see the Supabase Dashboard configuration note in
// components/auth/customer-auth-form.tsx and the admin Staff Management
// screen. Bumped the minimum length to 10 (from the previous 8): requiring
// four separate character classes in only 8 characters leaves very little
// room, and 10 is a more comfortable floor at this level of complexity
// without asking for anything exotic.
// ============================================================================
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password is too long")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol");

export const signUpSchema = z.object({
  email: normalisedEmail(),
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
