import { z } from "zod";

// ============================================================================
// S7 My Account — profile editing.
//
// Reuses the same field rules already established for the booking form
// (lib/validations/booking.ts) — a customer's name, address, and driving
// permit number should be held to the identical standard whether entered
// at booking time or edited afterward from their account.
//
// Phone is intentionally simpler here than the booking form's
// phoneCountry + phone split: the stored value is already a valid E.164
// number from whenever the account was created, so editing it just needs a
// sanity check (starts with +, reasonable length), not the full country
// selector used to construct one from scratch.
// ============================================================================

const cleaned = () => z.string().transform((v) => v.trim().replace(/\s+/g, " "));
const NAME_PATTERN = /^[\p{L}][\p{L}\s'’.-]*$/u;

export const profileUpdateSchema = z.object({
  firstName: cleaned().pipe(
    z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name is too long")
      .regex(NAME_PATTERN, "First name can only contain letters, spaces, hyphens and apostrophes")
  ),
  lastName: cleaned().pipe(
    z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name is too long")
      .regex(NAME_PATTERN, "Last name can only contain letters, spaces, hyphens and apostrophes")
  ),
  phone: cleaned().pipe(
    z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number, including the country code (e.g. +18684900175)")
  ),
  address: cleaned().pipe(
    z.string().min(5, "Enter a full address").max(255, "Address is too long")
  ),
  drivingPermitNumber: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(
      z
        .string()
        .min(1, "Driving permit number is required")
        .max(50, "Driving permit number is too long")
        .regex(/^[A-Z0-9\s-]+$/, "Driving permit number can only contain letters, numbers, hyphens and spaces")
    ),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
